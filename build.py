"""Build the app.
- hiveear.html: page body for claude.ai Artifacts (the host adds <html>/<head>).
- index.html:  complete standalone page for GitHub Pages / any browser.
Usage: python3 build.py
"""
src = open('app.src.html', encoding='utf-8').read()
engine = open('engine.js', encoding='utf-8').read()
body = src.replace('/*__ENGINE__*/', engine)

head = ('<!doctype html>\n<html lang="en">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="description" content="HiveEar: AI hive-health check from 30 seconds of hive sound.">\n'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0;font:14px/1.5 system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
        '</head>\n<body>\n')
open('index.html', 'w', encoding='utf-8').write(head + body + '\n</body>\n</html>\n')
open('hiveear.html', 'w', encoding='utf-8').write(body)
print('built index.html and hiveear.html')
