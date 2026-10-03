const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('camel', {
  win: { min: () => ipcRenderer.send('win:min'), max: () => ipcRenderer.send('win:max'), close: () => ipcRenderer.send('win:close'), onState: fn => ipcRenderer.on('win:state', (_e, v) => fn(v)) },
  info: () => ipcRenderer.invoke('app:info'),
  open: url => ipcRenderer.invoke('open:url', url),
  games: {
    list: () => ipcRenderer.invoke('games:list'),
    install: (id, source) => ipcRenderer.invoke('games:install', id, source),
    uninstall: id => ipcRenderer.invoke('games:uninstall', id),
    launch: (id, session) => ipcRenderer.invoke('games:launch', id, session),
    folder: id => ipcRenderer.invoke('games:folder', id),
    onProgress: fn => ipcRenderer.on('games:progress', (_e, v) => fn(v)),
    onExit: fn => ipcRenderer.on('games:exit', (_e, v) => fn(v))
  },
  chooseLibrary: () => ipcRenderer.invoke('settings:library'),
  update: { check: () => ipcRenderer.invoke('client:check'), apply: () => ipcRenderer.invoke('client:update'), onProgress: fn => ipcRenderer.on('client:progress', (_e, v) => fn(v)) }
});
