import { useCallback, useEffect, useState } from "react";
import "./App.css";

import browser, { Runtime } from "webextension-polyfill";
import { Config, defaultConfig } from "./defaultConfig";
import { TabStats } from "./background";

const RESET_CONFIG = false;
const RESET_CONFIG_BUTTON = false;

function App() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [inputValue, setInputValue] = useState("");
  const [rulesCount, setRulesCount] = useState(0);
  const [tabStats, setTabStats] = useState<TabStats>({
    blockedCount: 0,
    blockedDomains: [],
    requestCount: 0,
    thirdPartyBlockedCount: 0,
    requestedDomains: [],
  });

  const [openConfigTab, setOpenConfigTab] = useState<number | null>(null);

  const updateConfig = useCallback(
    (configPartial: Partial<Config>) => {
      const newConfig = {
        ...config,
        ...configPartial,
      };

      // cleanup empty lists
      newConfig.adblockLists = newConfig.adblockLists.filter(
        (list) => list.length > 0
      );

      browser.storage.sync.set({
        config: newConfig,
      });

      browser.runtime.sendMessage({ type: "refresh-config" });

      setConfig(newConfig);

      console.log("Updated config", newConfig);
    },
    [config, setConfig]
  );

  useEffect(() => {
    // request rules count from background script
    browser.runtime.sendMessage({ type: "get-rules-count" }).then((res) => {
      const pRes = res as { rulesCount: number };
      setRulesCount(pRes.rulesCount);
    });

    browser.runtime.sendMessage({ type: "get-tab-stats" }).then((res) => {
      const pRes = res as TabStats;
      console.log("Tab stats", pRes);
      setTabStats(pRes);
    });

    const handleBlur = () => {
      browser.runtime.sendMessage({ type: "refresh-engine" });
    };

    // when extension popup is closed
    window.addEventListener("blur", handleBlur);

    const handleMessage = (
      message: unknown,
      _: Runtime.MessageSender,
      sendResponse: (message: unknown) => void
    ) => {
      const msg = message as {
        type: string;
        data: unknown;
      };

      if (msg.type === "rules-count-update") {
        const msg = message as {
          type: string;
          data: { rulesCount: number };
        };

        console.log("[APP] Rules count update", msg.data);

        setRulesCount(msg.data.rulesCount);

        sendResponse(undefined);
      }

      if (msg.type === "tab-stats-update") {
        const msg = message as {
          type: string;
          data: TabStats;
        };

        console.log("[APP] Tab stats update", msg.data);

        setTabStats(msg.data);

        sendResponse(undefined);
      }

      return undefined;
    };

    browser.runtime.onMessage.addListener(handleMessage);

    browser.storage.sync.get("config").then((res) => {
      if (res.config && Object.keys(res.config).length > 0 && !RESET_CONFIG) {
        setConfig(res.config as Config);
      } else {
        browser.storage.sync.set({
          defaultConfig,
        });

        browser.runtime.sendMessage({ type: "refresh-config" }).then(() => {});

        console.log("Set default config");
      }
    });

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return (
    <div className="w-72">
      <div className="bg-slate-800 flex items-center justify-between font-bold px-3 py-2">
        <h1>AdBlock Insper</h1>
        <div>
          <span className="font-normal text-sm pr-1">
            {config.protectionEnabled ? "ON" : "OFF"}
          </span>
          <input
            type="checkbox"
            className="ml-auto"
            checked={config.protectionEnabled}
            onChange={() =>
              updateConfig({ protectionEnabled: !config.protectionEnabled })
            }
          />
        </div>
      </div>
      {import.meta.env.MODE === "development" && RESET_CONFIG_BUTTON && (
        <div
          className="bg-red-800 hover:bg-red-700 cursor-pointer flex items-center justify-center font-bold py-1"
          onClick={() => {
            updateConfig(defaultConfig);
          }}
        >
          <h1 className="text-sm">[DEV MODE] RESET CONFIG</h1>
        </div>
      )}
      <div className="bg-slate-600 pt-2 pb-3 flex-col flex items-center justify-center font-bold">
        <h1 className="text-4xl">
          {tabStats.blockedDomains.length}{" "}
          <span className="text-slate-400 font-thin">/</span>{" "}
          <span className="text-slate-300 font-normal">
            {tabStats.requestedDomains.length}
          </span>
        </h1>

        <p className="text-sm text-center text-balance mx-4">
          domínios bloqueados
        </p>

        <p className="text-sm text-center text-balance mx-4 font-normal mt-1">
          ({tabStats.blockedCount}/{tabStats.requestCount} requisições)
        </p>
      </div>

      <div className="flex bg-green-300">
        <div
          className="bg-red-300 h-2"
          style={{
            flexGrow:
              tabStats.blockedDomains.length > 0
                ? tabStats.blockedDomains.length /
                  tabStats.requestedDomains.length
                : 0,
          }}
        ></div>
      </div>
      <div className="bg-slate-300 text-black text-sm">
        <div
          className="px-2 py-1 flex justify-between items-center border-b-[1px] border-b-slate-300 cursor-pointer bg-slate-200"
          onClick={() => {
            setOpenConfigTab(openConfigTab === 0 ? null : 0);
            setInputValue("");
          }}
        >
          <h2 className="font-bold text-base flex items-center">
            <svg
              className={`fill-slate-950 size-2 mr-1 inline-block transition-transform ${
                openConfigTab === 0 ? "rotate-90" : ""
              }`}
              height="800px"
              width="800px"
              version="1.1"
              id="Capa_1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 185.343 185.343"
            >
              <g>
                <g>
                  <path d="M51.707,185.343c-2.741,0-5.493-1.044-7.593-3.149c-4.194-4.194-4.194-10.981,0-15.175    l74.352-74.347L44.114,18.32c-4.194-4.194-4.194-10.987,0-15.175c4.194-4.194,10.987-4.194,15.18,0l81.934,81.934    c4.194,4.194,4.194,10.987,0,15.175l-81.934,81.939C57.201,184.293,54.454,185.343,51.707,185.343z" />
                </g>
              </g>
            </svg>
            Minhas Listas
          </h2>
          <h3>{rulesCount.toLocaleString()} regras</h3>
        </div>
        {openConfigTab === 0 && (
          <ul className="divide-y-[1px] divide-slate-300">
            {config.adblockLists.map((list, index) => (
              <li
                key={index}
                className="text-sm py-1 px-2 flex flex-row items-center justify-between"
              >
                {list}
                <button
                  className="size-4 bg-slate-400 text-white px-1 rounded hover:bg-slate-500"
                  onClick={() =>
                    updateConfig({
                      adblockLists: config.adblockLists.filter(
                        (_, i) => i !== index
                      ),
                    })
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-2"
                    fill="#000000"
                    height="800px"
                    width="800px"
                    version="1.1"
                    id="Capa_1"
                    viewBox="0 0 460.775 460.775"
                  >
                    <path d="M285.08,230.397L456.218,59.27c6.076-6.077,6.076-15.911,0-21.986L423.511,4.565c-2.913-2.911-6.866-4.55-10.992-4.55  c-4.127,0-8.08,1.639-10.993,4.55l-171.138,171.14L59.25,4.565c-2.913-2.911-6.866-4.55-10.993-4.55  c-4.126,0-8.08,1.639-10.992,4.55L4.558,37.284c-6.077,6.075-6.077,15.909,0,21.986l171.138,171.128L4.575,401.505  c-6.074,6.077-6.074,15.911,0,21.986l32.709,32.719c2.911,2.911,6.865,4.55,10.992,4.55c4.127,0,8.08-1.639,10.994-4.55  l171.117-171.12l171.118,171.12c2.913,2.911,6.866,4.55,10.993,4.55c4.128,0,8.081-1.639,10.992-4.55l32.709-32.719  c6.074-6.075,6.074-15.909,0-21.986L285.08,230.397z" />
                  </svg>
                </button>
              </li>
            ))}
            <li className="py-1 px-2 flex flex-row bg-slate-300 text-black items-center justify-between">
              <input
                type="text"
                className="w-full bg-slate-300 focus:outline-none pb-1 placeholder:text-slate-600 placeholder:font-semibold"
                placeholder="+ Adicionar lista por URL"
                value={inputValue}
                onChange={(e) => setInputValue(e.currentTarget.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    updateConfig({
                      adblockLists: [
                        ...config.adblockLists,
                        e.currentTarget.value,
                      ],
                    });
                    setInputValue("");
                  }
                }}
              />
              {inputValue && (
                <button
                  className="ml-2 bg-slate-400 text-black text-white px-2 rounded hover:bg-slate-500"
                  onClick={() => {
                    updateConfig({
                      adblockLists: [...config.adblockLists, inputValue],
                    });
                    setInputValue("");
                  }}
                >
                  Add
                </button>
              )}
            </li>
          </ul>
        )}
        <div
          className="px-2 py-1 bg-slate-200 flex justify-between items-center border-b-[1px] border-b-slate-300 cursor-pointer"
          onClick={() => {
            setOpenConfigTab(openConfigTab === 1 ? null : 1);
            setInputValue("");
          }}
        >
          <h2 className="font-bold text-base flex items-center">
            <svg
              className={`fill-slate-950 size-2 mr-1 inline-block transition-transform ${
                openConfigTab === 1 ? "rotate-90" : ""
              }`}
              height="800px"
              width="800px"
              version="1.1"
              id="Capa_1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 185.343 185.343"
            >
              <g>
                <g>
                  <path d="M51.707,185.343c-2.741,0-5.493-1.044-7.593-3.149c-4.194-4.194-4.194-10.981,0-15.175    l74.352-74.347L44.114,18.32c-4.194-4.194-4.194-10.987,0-15.175c4.194-4.194,10.987-4.194,15.18,0l81.934,81.934    c4.194,4.194,4.194,10.987,0,15.175l-81.934,81.939C57.201,184.293,54.454,185.343,51.707,185.343z" />
                </g>
              </g>
            </svg>
            Domínios
          </h2>
          <h3>
            {config.blockedDomains.length} domínio
            {config.blockedDomains.length !== 1 ? "s" : ""}
          </h3>
        </div>
        {openConfigTab === 1 && (
          <ul className="divide-y-[1px] divide-slate-300 bg-slate-300">
            {config.blockedDomains.map((list, index) => (
              <li
                key={index}
                className="text-sm py-1 px-2 flex flex-row items-center justify-between"
              >
                {list}
                <button
                  className="size-4 bg-slate-400 text-white px-1 rounded hover:bg-slate-500"
                  onClick={() =>
                    updateConfig({
                      blockedDomains: config.blockedDomains.filter(
                        (_, i) => i !== index
                      ),
                    })
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-2"
                    fill="#000000"
                    height="800px"
                    width="800px"
                    version="1.1"
                    id="Capa_1"
                    viewBox="0 0 460.775 460.775"
                  >
                    <path d="M285.08,230.397L456.218,59.27c6.076-6.077,6.076-15.911,0-21.986L423.511,4.565c-2.913-2.911-6.866-4.55-10.992-4.55  c-4.127,0-8.08,1.639-10.993,4.55l-171.138,171.14L59.25,4.565c-2.913-2.911-6.866-4.55-10.993-4.55  c-4.126,0-8.08,1.639-10.992,4.55L4.558,37.284c-6.077,6.075-6.077,15.909,0,21.986l171.138,171.128L4.575,401.505  c-6.074,6.077-6.074,15.911,0,21.986l32.709,32.719c2.911,2.911,6.865,4.55,10.992,4.55c4.127,0,8.08-1.639,10.994-4.55  l171.117-171.12l171.118,171.12c2.913,2.911,6.866,4.55,10.993,4.55c4.128,0,8.081-1.639,10.992-4.55l32.709-32.719  c6.074-6.075,6.074-15.909,0-21.986L285.08,230.397z" />
                  </svg>
                </button>
              </li>
            ))}
            <li className="py-1 px-2 flex flex-row bg-slate-300 text-black items-center justify-between">
              <input
                type="text"
                className="w-full bg-slate-300 focus:outline-none pb-1 placeholder:text-slate-600 placeholder:font-semibold"
                placeholder="+ Adicionar domínio"
                value={inputValue}
                onChange={(e) => setInputValue(e.currentTarget.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    updateConfig({
                      blockedDomains: [
                        ...config.blockedDomains,
                        e.currentTarget.value,
                      ],
                    });
                    setInputValue("");
                  }
                }}
              />
              {inputValue && (
                <button
                  className="ml-2 bg-slate-400 text-white px-2 rounded hover:bg-slate-500"
                  onClick={() => {
                    updateConfig({
                      blockedDomains: [...config.blockedDomains, inputValue],
                    });
                    setInputValue("");
                  }}
                >
                  Add
                </button>
              )}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
