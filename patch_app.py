with open('src/js/app.js', 'r') as f:
    content = f.read()

target = """  // Update toggle button text globally
  if (state.isChartImageVisible) {
    u('#btn-toggle-image').text('画像: ON');
  } else {
    u('#btn-toggle-image').text('画像: OFF');
  }"""

replacement = """  // Update toggle button text globally
  if (state.isChartImageVisible) {
    u('#btn-toggle-image').text('🖼 譜面画像 ON');
  } else {
    u('#btn-toggle-image').text('🖼 譜面画像 OFF');
  }
  
  // Update zoom label
  if (u('#zoom-label').nodes.length > 0) {
    u('#zoom-label').text(state.zoomLevel + '%');
  }"""

if target in content:
    with open('src/js/app.js', 'w') as f:
        f.write(content.replace(target, replacement))
else:
    print("Not found")
