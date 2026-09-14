with open('src/css/base.css', 'r') as f:
    content = f.read()

target = """/* スマートフォン向けの操作性改善 (PWA UX) */
@media (max-width: 768px) {
  .area-footer {
    padding: 6px 10px !important;
    gap: 6px !important;
  }
  .button {
    padding: 7px 11px !important;
    font-size: 12px !important;
    min-height: 34px !important;
  }
  .button-group {
    gap: 5px !important;
  }
}

/* スマートフォン横画面時のコンパクト化（高さを圧迫しないように調整） */
@media (max-height: 500px) and (max-width: 1024px) {
  .area-footer {
    padding: 4px 8px !important;
    gap: 4px !important;
  }
  .button {
    padding: 5px 9px !important;
    font-size: 11px !important;
    min-height: 30px !important;
  }
  .button-group {
    gap: 4px !important;
  }
}"""

replacement = """/* スマートフォン向けの操作性改善 (PWA UX) */
@media (max-width: 768px) {
  .area-footer {
    padding: 6px 10px !important;
    gap: 6px !important;
  }
  .button {
    padding: 7px 11px !important;
    font-size: 12px !important;
    min-height: 34px !important;
  }
  .zoom-controls .button.btn-icon {
    padding: 7px 11px !important;
  }
  .button-group {
    gap: 5px !important;
  }
  .footer-row {
    gap: 6px !important;
  }
}

/* スマートフォン横画面時のコンパクト化（高さを圧迫しないように調整） */
@media (max-height: 500px) and (max-width: 1024px) {
  .area-footer {
    padding: 4px 8px !important;
    gap: 4px !important;
  }
  .button {
    padding: 5px 9px !important;
    font-size: 11px !important;
    min-height: 30px !important;
  }
  .zoom-controls .button.btn-icon {
    padding: 5px 9px !important;
  }
  .button-group {
    gap: 4px !important;
  }
  .footer-row {
    gap: 4px !important;
  }
}"""

if target in content:
    with open('src/css/base.css', 'w') as f:
        f.write(content.replace(target, replacement))
else:
    print("Not found")
