const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("newsdesk", {
  listItems: (opts) => ipcRenderer.invoke("items:list", opts),
  getSources: () => ipcRenderer.invoke("sources:list"),
  openItem: (itemId) => ipcRenderer.invoke("items:open", { itemId }),
  markRead: (itemId, isRead) => ipcRenderer.invoke("items:read", { itemId, isRead }),
  toggleStar: (itemId) => ipcRenderer.invoke("items:star", { itemId }),

  setListWidth: (width) => ipcRenderer.invoke("ui:setListWidth", { width }),
  setSidebarWidth: (width) => ipcRenderer.invoke("ui:setSidebarWidth", { width }),
  closeArticle: () => ipcRenderer.invoke("ui:closeArticle"),
  setReaderMode: (enabled) => ipcRenderer.invoke("ui:setReaderMode", { enabled }),
  setSourceColors: ({ sourceId, textColor, bgColor }) => ipcRenderer.invoke("sources:setColors", { sourceId, textColor, bgColor }),
  addSource: ({ name, feedUrl, domain, textColor, bgColor }) => ipcRenderer.invoke("sources:add", { name, feedUrl, domain, textColor, bgColor })
});
