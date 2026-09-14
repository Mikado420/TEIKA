with open('index.html', 'r') as f:
    content = f.read()

target = """    <div class="area-errors"><div class="errors">No error</div></div>"""
replacement = """    <div class="area-errors is-success" id="area-errors"><div class="errors" id="error-text">✓ No error</div></div>"""

if target in content:
    with open('index.html', 'w') as f:
        f.write(content.replace(target, replacement))
else:
    print("Not found html")
