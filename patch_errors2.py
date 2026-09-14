import re

with open('src/css/base.css', 'r') as f:
    content = f.read()

content = re.sub(
    r'\.area-errors\s*\{[^}]+\}',
    '.area-errors { background: #2a1414; font-size: 11px; color: #ff8888; padding: 4px 10px; border-top: 1px solid #4a1c1c; font-family: monospace; transition: all 0.2s ease; }\n    .area-errors.is-success { background: transparent; color: #6e7681; border-top: 1px solid #222227; }',
    content
)

with open('src/css/base.css', 'w') as f:
    f.write(content)
