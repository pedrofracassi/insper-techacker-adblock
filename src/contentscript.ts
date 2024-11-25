import browser from "webextension-polyfill";

browser.runtime.sendMessage({
  type: "reset-tab-stats",
});
