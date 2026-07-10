;(() => {
  try {
    const mode = localStorage.getItem('retiregolden.theme') || 'system'
    document.documentElement.dataset.theme = ['light', 'dark', 'system'].includes(mode) ? mode : 'system'
  } catch {
    document.documentElement.dataset.theme = 'system'
  }
})()
