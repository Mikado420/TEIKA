with open('src/css/base.css', 'r') as f:
    content = f.read()

target = """    /* フッター・ボタン等のダークモード・UXリファイン */
    .area-footer { 
      flex-shrink: 0; 
      background: #141418; 
      padding: 6px 10px; 
      display: flex; 
      flex-direction: column; 
      gap: 6px; 
      border-top: 1px solid #222227; 
      box-shadow: 0 -4px 16px rgba(0,0,0,0.25);
    }
    .button-group { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }"""

replacement = """    /* フッター・ボタン等のダークモード・UXリファイン */
    .area-footer { 
      flex-shrink: 0; 
      background: #141418; 
      padding: 8px 12px; 
      display: flex; 
      flex-direction: column; 
      gap: 8px; 
      border-top: 1px solid #222227; 
      box-shadow: 0 -4px 16px rgba(0,0,0,0.25);
    }
    .footer-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .difficulty-row {
      border-bottom: 1px solid #222227;
      padding-bottom: 8px;
    }
    .tools-row {
      justify-content: space-between;
    }
    .row-label {
      font-size: 11px;
      color: #8c8c9e;
      font-weight: bold;
    }
    .button-group { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
    
    .controls-view {
      margin-left: auto;
    }
    
    .zoom-controls {
      display: flex;
      align-items: center;
      background: #1a1a20;
      border: 1px solid #333340;
      border-radius: 4px;
      overflow: hidden;
    }
    .zoom-controls .button.btn-icon {
      border: none;
      border-radius: 0;
      background: transparent;
      padding: 6px 10px;
    }
    .zoom-controls .button.btn-icon:hover {
      background: #2e2e38;
    }
    .zoom-controls .zoom-label {
      font-size: 11px;
      color: #c9c9d4;
      padding: 0 4px;
      min-width: 40px;
      text-align: center;
    }"""

import re
# We'll just replace lines 42-53 roughly using re since exact match failed
lines = content.split('\n')
new_lines = lines[:41] + replacement.split('\n') + lines[53:]
with open('src/css/base.css', 'w') as f:
    f.write('\n'.join(new_lines))
