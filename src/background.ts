import browser from "webextension-polyfill";

// const getOptionsObject = browser.storage.sync.get("optionsObject");
import {
  BufferRuleList,
  Engine,
  FilterListPreprocessor,
  Request,
  RequestType,
  RuleStorage,
  setConfiguration,
} from "@adguard/tsurlfilter";
import { Config, defaultConfig } from "./defaultConfig";

let config: Config | null = null;

const fetchConfig = async () => {
  const res = await browser.storage.sync.get("config");
  if (res.config && Object.keys(res.config).length > 0) {
    config = res.config as Config;
  } else {
    browser.storage.sync.set({
      config: defaultConfig,
    });
  }
};

setInterval(fetchConfig, 1000);

async function loadFilterList(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}

async function initializeEngine() {
  if (!config) {
    await fetchConfig();
  }
  const rawFilters = config?.adblockLists
    ? await Promise.all(config.adblockLists.map(loadFilterList))
    : [];
  const processedFilters = rawFilters.map((rawFilter, index) => {
    const processedFilter = FilterListPreprocessor.preprocess(rawFilter);
    return new BufferRuleList(
      index,
      processedFilter.filterList,
      false,
      false,
      false,
      processedFilter.sourceMap
    );
  });

  const ruleStorage = new RuleStorage(processedFilters);

  const engineConfig = {
    engine: "extension",
    version: "1.0.0",
    verbose: true,
  };

  setConfiguration(engineConfig);

  const engine = new Engine(ruleStorage);

  console.log(`Engine loaded with ${engine.getRulesCount()} rule(s)`);
  return engine;
}

let engine: Engine;

initializeEngine().then((eng) => {
  engine = eng;
});

browser.webRequest.onBeforeRequest.addListener(
  function (requestDetails) {
    if (config && !config.protectionEnabled) {
      return {
        cancel: false,
      };
    }

    const documentUrl = requestDetails.documentUrl;

    if (documentUrl === undefined) {
      return;
    }

    let cancel = false;

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

    /*
    optionsObject.forEach((option) => {
      const addressBarUrlRegExp = new RegExp(option.addressBarUrlPattern);

      if (addressBarUrlRegExp.test(documentUrl)) {
        const requestsToBlockPatterns = option.requestsToBlockPatterns;

        requestsToBlockPatterns.forEach((requestToBlockPattern) => {
          const requestToBlockRegExp = new RegExp(requestToBlockPattern);

          if (requestToBlockRegExp.test(url)) {
            console.log("addressBarUrl " + option.addressBarUrlPattern);
            console.log("request to block: " + requestToBlockPattern);
            console.log("Canceling " + url + " request");
            console.log("----------");

            cancel = true;
          }
        });
      }
    });
    */

    return {
      cancel: cancel,
    };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
