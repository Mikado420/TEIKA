with open('src/js/app.js', 'r') as f:
    content = f.read()

content = content.replace("saved.split('\\n\\n').length", "saved.split('\\n').length")
content = content.replace("saved.split('\\n\n').length", "saved.split('\\n').length")

with open('src/js/app.js', 'w') as f:
    f.write(content)
