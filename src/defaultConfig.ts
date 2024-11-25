export interface Config {
  protectionEnabled: boolean;
  adblockLists: string[];
  blockedDomains: string[];
}

export const defaultConfig: Config = {
  protectionEnabled: true,
  adblockLists: [
    "https://easylist.to/easylist/easylist.txt",
    "https://big.oisd.nl",
  ],
  blockedDomains: [],
};
