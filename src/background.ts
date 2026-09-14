// Service worker。
// 新标签页扩展本身几乎不需要后台逻辑，只处理工具栏图标点击。

chrome.action?.onClicked.addListener(() => {
  chrome.tabs.create({})
})
