#!/usr/bin/env python3
"""
_project-improvement/tools/visual-regression-check.py

用真實瀏覽器（Playwright + Chromium）分別載入兩個版本的 index.html，
把主要畫面（screen-1~4）截圖，逐像素比對差異百分比。

為什麼需要這支工具：光看CSS規則文字或AST結構「邏輯上」相同，不代表HTML
標籤本身有沒有被意外弄壞（階段5第一次嘗試合併補丁時，就發生過說明註解
裡不小心寫了字面上的"</style>"，導致標籤被瀏覽器提前截斷，但CSS規則的
「總量與內容」剛好還是對得上、只有真正截圖比對或檢查標籤邊界才抓得到）。
所以任何一動到 index.html 樣式或結構的階段，除了用 verify-style-boundaries.js
/verify-script-boundaries.js 做結構檢查之外，都應該再用這支工具做視覺回歸。

已知限制：
- 這個環境對外部CDN(cdnjs.cloudflare.com、identity.netlify.com)的連線會被
  擋下(403)，導致Chart.js圖表與Google登入元件不會真的渲染出來；只要「改動前」
  跟「改動後」用同一個環境跑，這個限制不影響比對的有效性(兩邊都一樣缺)。
- app本身有部分內容用 Math.random() 產生模擬數據，就算同一份檔案跑兩次
  截圖也會有極少數像素不同（screen-3/4 各約 0.0008%~0.0085%，這是本工具
  第一次使用時實測的雜訊基準值，非本工具的bug）。判讀時應該把這個雜訊基準
  納入考量，不要看到 <0.01% 的差異就緊張。
- screen-2/3/4 是用JS強制切換display顯示出來的，不是真的跑完整精靈流程，
  所以看不到需要填完表單才會出現的動態內容(例如 .scenario-card/.summary-card
  這類分析完成後才產生的元件)；這些元件的視覺驗證仍須仰賴CSS規則文字比對
  （見 classify-style-patches.js 的輸出）或未來手動在真實瀏覽器上操作驗證。

用法：
    python3 visual-regression-check.py <改動前index.html路徑> <改動後index.html路徑> [輸出資料夾]
"""
import sys
import os
from playwright.sync_api import sync_playwright

def capture(html_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    abspath = os.path.abspath(html_path)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.goto(f"file://{abspath}", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{out_dir}/screen-1.png", full_page=True)
        for sid in ['screen-2', 'screen-3', 'screen-4']:
            page.evaluate(f"""() => {{
                document.querySelectorAll('[id^="screen-"]').forEach(e => e.style.display = 'none');
                const el = document.getElementById('{sid}');
                if (el) el.style.display = 'flex';
            }}""")
            page.wait_for_timeout(300)
            page.screenshot(path=f"{out_dir}/{sid}.png", full_page=True)
        browser.close()

def compare(dir_before, dir_after):
    from PIL import Image, ImageChops
    import numpy as np
    results = {}
    for name in ['screen-1', 'screen-2', 'screen-3', 'screen-4']:
        a = Image.open(f"{dir_before}/{name}.png").convert('RGB')
        b = Image.open(f"{dir_after}/{name}.png").convert('RGB')
        if a.size != b.size:
            results[name] = {'error': f'尺寸不同 {a.size} vs {b.size}'}
            continue
        diff = ImageChops.difference(a, b)
        arr = np.array(diff)
        nonzero = int((arr.sum(axis=2) > 0).sum())
        total = arr.shape[0] * arr.shape[1]
        results[name] = {'diff_pixels': nonzero, 'total_pixels': total, 'pct': 100 * nonzero / total}
    return results

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    before_html, after_html = sys.argv[1], sys.argv[2]
    out_base = sys.argv[3] if len(sys.argv) > 3 else '/tmp/visual-regression'
    dir_before = f"{out_base}/before"
    dir_after = f"{out_base}/after"
    print("正在截圖改動前版本...")
    capture(before_html, dir_before)
    print("正在截圖改動後版本...")
    capture(after_html, dir_after)
    print("正在比對...\n")
    results = compare(dir_before, dir_after)
    NOISE_FLOOR_PCT = 0.01  # 已知的Math.random()等非決定性內容造成的雜訊基準值上限
    all_ok = True
    for name, r in results.items():
        if 'error' in r:
            print(f"❌ {name}: {r['error']}")
            all_ok = False
        elif r['pct'] > NOISE_FLOOR_PCT:
            print(f"⚠️  {name}: {r['diff_pixels']}/{r['total_pixels']} 像素不同 ({r['pct']:.4f}%) —— 超過雜訊基準值，需要人工檢查截圖確認是否為真正的視覺變化")
            all_ok = False
        else:
            print(f"✅ {name}: {r['diff_pixels']}/{r['total_pixels']} 像素不同 ({r['pct']:.4f}%) —— 在雜訊基準值內，視為無視覺差異")
    print("")
    print("結論：" + ("視覺上與改動前一致（差異皆在已知雜訊基準值內）" if all_ok else "發現需要人工確認的視覺差異，請勿直接視為安全"))
    sys.exit(0 if all_ok else 1)
