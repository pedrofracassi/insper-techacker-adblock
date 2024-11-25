import browser, { Tabs } from "webextension-polyfill";

console.log("Background script running");

// const getOptionsObject = browser.storage.sync.get("optionsObject");
import {
  BufferRuleList,
  Engine,
  FilterListPreprocessor,
  IConfiguration,
  IRuleList,
  PreprocessedFilterList,
  Request,
  RequestType,
  RuleStorage,
  setConfiguration,
} from "@adguard/tsurlfilter";
import { Config, defaultConfig } from "./defaultConfig";

let config: Config | null = null;

let activeTab: Tabs.Tab;
// get the active tab
browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs.length > 0) {
    activeTab = tabs[0];
  }
});

export interface TabStats {
  blockedCount: number;
  requestCount: number;
  blockedDomains: string[];
  requestedDomains: string[];
  thirdPartyBlockedCount: number;
}

const getEmptyTabStats = () => {
  return {
    blockedCount: 0,
    requestCount: 0,
    blockedDomains: [],
    requestedDomains: [],
    thirdPartyBlockedCount: 0,
  };
};

const tabStats: {
  [tabId: number]: TabStats;
} = {};

const fetchConfig = async (refreshWhenDone: boolean = false) => {
  const res = await browser.storage.sync.get("config");
  if (res.config && Object.keys(res.config).length > 0) {
    config = res.config as Config;
  } else {
    browser.storage.sync.set({
      config: defaultConfig,
    });
  }

  // set favicon
  browser.browserAction.setIcon({
    path: config?.protectionEnabled ? "favicon.jpg" : "favicon_off.jpg",
  });

  if (refreshWhenDone) {
    browser.tabs.reload();
  }
};

async function loadFilterList(url: string): Promise<string> {
  const response = await fetch(url).catch((error) => {
    console.error(`Failed to fetch ${url}: ${error}`);
    return "";
  });
  if (response instanceof Response) {
    return response.text();
  }
  return "";
}

let previousAdblockLists: string[] | null = null;

let engine: Engine;

async function initializeEngine() {
  await fetchConfig();

  if (
    JSON.stringify(config?.adblockLists) ===
    JSON.stringify(previousAdblockLists)
  ) {
    console.log("Adblock lists have not changed, skipping reinitialization.");
    return;
  }

  previousAdblockLists = config?.adblockLists || [];

  const processedFilters: IRuleList[] = await Promise.all(
    (config?.adblockLists || []).map(async (url, index) => {
      const cacheKey = `processedFilter_${index}`;
      const cachedFilter = await browser.storage.local.get(cacheKey);
      if (cachedFilter[cacheKey]) {
        const cachedPreprocessedFilter = cachedFilter[
          cacheKey
        ] as PreprocessedFilterList;
        const bufferRuleList = new BufferRuleList(
          index,
          cachedPreprocessedFilter.filterList,
          false,
          false,
          false,
          cachedPreprocessedFilter.sourceMap
        ) as IRuleList;

        return bufferRuleList;
      }

      const rawFilter = await loadFilterList(url);
      const processedFilter = FilterListPreprocessor.preprocess(rawFilter);
      await browser.storage.local.set({
        [cacheKey]: processedFilter,
      });
      const bufferRuleList = new BufferRuleList(
        index,
        processedFilter.filterList,
        false,
        false,
        false,
        processedFilter.sourceMap
      ) as IRuleList;
      return bufferRuleList as IRuleList;
    })
  );

  const ruleStorage = new RuleStorage(processedFilters);

  const engineConfig: Partial<IConfiguration> = {
    engine: "extension",
    version: "1.0.0",
    verbose: false,
  };

  setConfiguration(engineConfig);

  const newEngine = new Engine(ruleStorage);

  console.log(`Engine loaded with ${newEngine.getRulesCount()} rule(s)`);

  browser.runtime.sendMessage({
    type: "rules-count-update",
    data: {
      rulesCount: newEngine.getRulesCount(),
    },
  });

  engine = newEngine;
}

browser.tabs.onRemoved.addListener((tabId) => {
  // send message
  console.log("Resetting tab", tabId);
  delete tabStats[tabId];
});

// on active tab change
browser.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;

  // update active tab
  browser.tabs.get(tabId).then((tab) => {
    activeTab = tab;
  });

  // send tab stats
  browser.runtime.sendMessage({
    type: "tab-stats-update",
    data: tabStats[tabId] || getEmptyTabStats(),
  });
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabStats[tabId] = getEmptyTabStats();
  }
});

browser.runtime.onMessage.addListener((message, _, sendResponse) => {
  const msg = message as {
    type: string;
    data?: unknown;
  };

  if (msg.type === "reset-tab") {
    console.log("Resetting tab", msg.data);

    if (typeof msg.data !== "number") {
      throw new Error("Invalid tabId");
    }

    tabStats[msg.data] = getEmptyTabStats();

    sendResponse(undefined);
  }

  if (msg.type === "get-tab-stats") {
    if (!activeTab) {
      console.log("No active tab found");
      sendResponse(getEmptyTabStats());
      return;
    }

    if (tabStats[activeTab.id!] === undefined) {
      console.log("No stats found for active tab");
      sendResponse(getEmptyTabStats());
      return;
    }

    console.log("Sending tab stats for active tab", activeTab.id);
    sendResponse(tabStats[activeTab.id!]);
  }

  if (msg.type === "get-rules-count") {
    sendResponse({
      rulesCount: engine ? engine.getRulesCount() : 0,
    });
  }

  if (msg.type === "refresh-config") {
    fetchConfig(true);
  }

  if (msg.type === "refresh-engine") {
    initializeEngine();
  }

  return undefined;
});

initializeEngine().catch((error) => {
  console.error("Failed to initialize engine:", error);
});

browser.webRequest.onBeforeRequest.addListener(
  function (requestDetails) {
    const tabId = requestDetails.tabId;

    let cancel = false;

    const documentUrl = requestDetails.documentUrl;

    if (documentUrl === undefined) {
      console.log("documentUrl is undefined");
      return;
    }

    let domainBlocked = false;

    // check if documentUrl matches domain in config.blockedDomains
    const documentHostname = new URL(documentUrl).hostname;
    if (config?.blockedDomains.includes(documentHostname)) {
      cancel = true;
      domainBlocked = true;
    }

    if (engine && !domainBlocked) {
      const result = engine.matchRequest(
        new Request(
          requestDetails.url,
          requestDetails.documentUrl || null,
          RequestType.Document
        )
      );

      const rule = result.getBasicResult();

      if (rule && !rule?.isAllowlist()) {
        cancel = true;
      }
    }

    if (config && !config.protectionEnabled) {
      cancel = false;
    }

    const thisTabStats = tabStats[tabId] || Object.assign({}, getEmptyTabStats);

    if (tabId !== -1) {
      if (cancel) {
        thisTabStats.blockedCount++;

        if (requestDetails.url) {
          const url = new URL(requestDetails.url);

          if (
            url.hostname &&
            thisTabStats.blockedDomains.indexOf(url.hostname) === -1
          ) {
            thisTabStats.blockedDomains.push(url.hostname);
          }

          if (thisTabStats.requestedDomains.indexOf(url.hostname) === -1) {
            thisTabStats.requestedDomains.push(url.hostname);
          }

          if (
            url.hostname &&
            requestDetails.documentUrl &&
            url.hostname !== new URL(requestDetails.documentUrl).hostname
          ) {
            thisTabStats.thirdPartyBlockedCount =
              (thisTabStats.thirdPartyBlockedCount || 0) + 1;
          }
        }

        console.log(
          `[${thisTabStats.blockedCount}] Blocked request ${requestDetails.url} from ${requestDetails.documentUrl}.`
        );
      }

      thisTabStats.requestCount++;

      browser.browserAction.setBadgeText({
        text: thisTabStats.blockedCount.toString(),
        tabId: tabId,
      });

      tabStats[tabId] = thisTabStats;

      browser.runtime.sendMessage({
        type: "tab-stats-update",
        data: thisTabStats,
      });
    }

    return {
      cancel: cancel,
    };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
