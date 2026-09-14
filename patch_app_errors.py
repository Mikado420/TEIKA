with open('src/js/app.js', 'r') as f:
    content = f.read()

target = """    try {
      state.tjaParsed = parseTJA(val);
      u('.errors').text('No error');
      if (state.errorLineNumber !== null) {
        state.errorLineNumber = null;
        updateHighlight();
      }
      localStorage.setItem('tja_tools_autosave', val);
    } catch (e) {
      u('.errors').text(e.message);
      const match = e.message.match(/(?:行|line)\s*([0-9]+)/i);
      if (match) {
        state.errorLineNumber = parseInt(match[1], 10);
      } else {
        state.errorLineNumber = null;
      }
      updateHighlight();
    }"""

replacement = """    try {
      state.tjaParsed = parseTJA(val);
      u('.errors').text('✓ No error');
      u('.area-errors').addClass('is-success');
      if (state.errorLineNumber !== null) {
        state.errorLineNumber = null;
        updateHighlight();
      }
      localStorage.setItem('tja_tools_autosave', val);
    } catch (e) {
      u('.errors').text(e.message);
      u('.area-errors').removeClass('is-success');
      const match = e.message.match(/(?:行|line)\s*([0-9]+)/i);
      if (match) {
        state.errorLineNumber = parseInt(match[1], 10);
      } else {
        state.errorLineNumber = null;
      }
      updateHighlight();
    }"""

if target in content:
    with open('src/js/app.js', 'w') as f:
        f.write(content.replace(target, replacement))
else:
    print("Not found target in app.js")
