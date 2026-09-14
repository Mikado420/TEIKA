with open('src/css/base.css', 'r') as f:
    content = f.read()

target = """    /* エラーパネル */
    .area-errors { 
       background: #2a1414; 
       font-size: 11px; 
       color: #ff8888; 
       padding: 4px 10px; 
       border-top: 1px solid #4a1c1c; 
       font-family: monospace;
    }"""

replacement = """    /* エラーパネル */
    .area-errors { 
       background: #2a1414; 
       font-size: 11px; 
       color: #ff8888; 
       padding: 4px 10px; 
       border-top: 1px solid #4a1c1c; 
       font-family: monospace;
       transition: all 0.2s;
    }
    .area-errors.is-success {
       background: #16161a;
       color: #6e7681;
       border-top: 1px solid #222227;
    }"""

if target in content:
    with open('src/css/base.css', 'w') as f:
        f.write(content.replace(target, replacement))
else:
    print("Not found")
