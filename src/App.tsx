import { useCallback, useEffect, useState } from "react";
import "./App.css";

import browser from "webextension-polyfill";
import { Config, defaultConfig } from "./defaultConfig";

const RESET_CONFIG = false;

function App() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [inputValue, setInputValue] = useState("");

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

      setConfig(newConfig);

      console.log("Updated config", newConfig);
    },
    [config, setConfig]
  );

  useEffect(() => {
    console.log("Getting protection enabled status");
    browser.storage.sync.get("config").then((res) => {
      if (res.config && Object.keys(res.config).length > 0 && !RESET_CONFIG) {
        setConfig(res.config as Config);
      } else {
        browser.storage.sync.set({
          config,
        });

        console.log("Set default config");
      }
    });
  }, [config, updateConfig]);

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
      <div className="bg-slate-600 py-3 flex-col flex items-center justify-center font-bold">
        <h1 className="text-4xl">67%</h1>
        <p className="text-sm">requisições bloqueadas</p>
      </div>
      <div className="bg-slate-200 text-black text-sm">
        <div>
          <h2 className="px-2 font-bold pt-1">Minhas Listas</h2>
        </div>
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
          <li className="py-1 px-2 flex flex-row bg-slate-200 text-black items-center justify-between">
            <input
              type="text"
              className="w-full bg-slate-200 focus:outline-none"
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
                className="ml-2 bg-slate-400 text-white px-2 rounded hover:bg-slate-500"
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
      </div>
    </div>
  );
}

export default App;
