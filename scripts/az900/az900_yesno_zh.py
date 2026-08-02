#!/usr/bin/env python3
"""是非型 HOTSPOT（55 題）陳述的中文翻譯。

英文陳述、判定（True/False）、中文解析全部已經從 PDF 文字層抽出來
（`az900_extract.extract_items()` + `.build/yesno_dump.json`），唯獨陳述
本身沒有現成的中文版——ExamTopics 的「選項分析」只給中文的分析理由，
不會重新翻譯一次英文陳述。所以這裡只補這一塊：陳述的中文翻譯，
按 `.build/yesno_dump.json` 裡每題陳述出現的順序排列。

解析文字沿用來源、不重寫；build 階段會自動清掉「分析：」「結論：…」
這類前綴/收尾贅字，再套簡轉繁跟 Azure 台灣術語表。
"""

# {題號: [陳述1中譯, 陳述2中譯, ...]}，順序對應 yesno_dump.json 裡的順序。
YESNO_ZH = {
    34: [
        '在 Azure 上託管 Web 應用程式的平台即服務 (PaaS) 解決方案，可讓你完全控制承載應用程式的作業系統。',
        '在 Azure 上託管 Web 應用程式的 PaaS 解決方案，可以透過變更定價層自動調整平台規模。',
        '在 Azure 上託管 Web 應用程式的 PaaS 解決方案，會持續提供專業開發服務，為自訂應用程式新增功能。',
    ],
    58: [
        'Azure 的隨用隨付定價是資本支出 (CapEx) 的例子。',
        '支付自有資料中心的電費是營運支出 (OpEx) 的例子。',
        '部署自己的資料中心是資本支出 (CapEx) 的例子。',
    ],
    67: [
        '建置資料中心基礎設施屬於營運支出 (OpEx) 成本的例子。',
        '技術人員的月薪屬於營運支出 (OpEx) 成本的例子。',
        '租賃軟體屬於營運支出 (OpEx) 成本的例子。',
    ],
    69: [
        '使用軟體即服務 (SaaS) 時，你必須自己套用軟體更新。',
        '使用基礎設施即服務 (IaaS) 時，你必須自己安裝要使用的軟體。',
        'Azure 備份 (Azure Backup) 是平台即服務 (PaaS) 的例子。',
    ],
    70: [
        '你可以在一個資源群組裡面再建立另一個資源群組。',
        '一台 Azure 虛擬機器可以同時屬於多個資源群組。',
        '一個資源群組可以包含來自多個 Azure 區域的資源。',
    ],
    76: [
        '雲端運算提供彈性擴展能力。',
        '客戶使用公有雲可以將資本支出 (CapEx) 降到最低。',
        '雲端運算利用虛擬化技術，同時為多個客戶提供服務。',
    ],
    78: [
        '企業可以透過把自己的實體伺服器加進公有雲，藉此擴充內部網路。',
        '私有雲必須與網際網路中斷連線。',
        '公有雲是混合雲的一部分。',
    ],
    100: [
        '一個 Azure 訂用帳戶可以同時關聯到多個 Azure Active Directory (Azure AD) 租用戶。',
        '你可以變更一個 Azure 訂用帳戶所關聯的 Azure Active Directory (Azure AD) 租用戶。',
        '當 Azure 訂用帳戶到期時，相關聯的 Azure Active Directory (Azure AD) 租用戶會自動被刪除。',
    ],
    103: [
        '單一個 Microsoft 帳戶可以用來管理多個 Azure 訂用帳戶。',
        '兩個 Azure 訂用帳戶可以合併成一個訂用帳戶。',
        '企業可以使用來自多個訂用帳戶的資源。',
    ],
    107: [
        '每個 Azure 訂用帳戶可以有多個帳戶系統管理員。',
        '每個 Azure 訂用帳戶只能用 Microsoft 帳戶來管理。',
        '一個 Azure 資源群組可以包含多個 Azure 訂用帳戶。',
    ],
    108: [
        '所有 Azure 區域都可以實作可用性區域。',
        '可用性區域裡只能建立執行 Windows Server 的虛擬機器。',
        '可用性區域是用來把資料與應用程式複寫到多個區域。',
    ],
    114: [
        '部署到同一個資源群組的所有 Azure 資源，都必須使用相同的 Azure 區域。',
        '把標記指派給資源群組，該資源群組裡的所有 Azure 資源也會一併套用同一個標記。',
        '如果你把管理某個資源群組的權限指派給使用者，該使用者就能管理該資源群組裡的所有 Azure 資源。',
    ],
    125: [
        'Windows Virtual Desktop 的工作階段主機只能執行 Windows 10。',
        '一個包含 20 台工作階段主機的 Windows Virtual Desktop 主機集區，最多只能支援 20 個同時連線的使用者。',
        'Windows Virtual Desktop 支援桌面與應用程式虛擬化。',
    ],
    128: [
        '網路安全性群組 (NSG) 可以包含多筆輸入與輸出安全性規則。',
        '執行特定功能（例如執行防火牆）的虛擬機器，也稱為網路虛擬設備 (NVA)。',
        '使用者定義路由 (UDR) 只能控制單一虛擬網路內部子網路之間的網路流量。',
    ],
    130: [
        '要用 Azure Active Directory (Azure AD) 認證登入一台執行 Windows 10 的電腦，該電腦必須加入 Azure AD。',
        'Azure Active Directory (Azure AD) 裡的使用者是用資源群組來組織的。',
        'Azure Active Directory (Azure AD) 群組支援動態成員資格規則。',
    ],
    134: [
        '封存 (Archive) 存取層是設定在儲存體帳戶層級的。',
        '對於經常被存取與修改的資料，建議使用經常 (Hot) 存取層。',
        '非經常 (Cool) 存取層適合用於長期備份。',
    ],
    166: [
        '透過 Azure 服務健康狀態 (Azure Service Health)，系統管理員可以檢視 Azure 環境中所有服務的健康狀態。',
        '透過 Azure 服務健康狀態，系統管理員可以建立規則，在 Azure 服務發生故障時收到警示。',
        '透過 Azure 服務健康狀態，系統管理員可以預先阻止服務故障發生。',
    ],
    197: [
        '你可以使用 Azure 成本管理 (Azure Cost Management) 檢視與管理群組相關聯的成本。',
        '你可以使用 Azure 成本管理檢視與資源群組相關聯的成本。',
        '你可以使用 Azure 成本管理檢視過去三個月虛擬機器的使用量。',
    ],
    200: [
        '你必須先在自己的電腦上安裝 Azure Cloud Shell 才能使用它。',
        'Azure 命令列介面 (CLI) 是 Windows 11 內建、預設就安裝好的。',
        'Azure PowerShell 可以在執行 Windows、Linux 或 macOS 的電腦上使用。',
    ],
    201: [
        '你必須有網際網路連線才能管理雲端服務。',
        '你必須安裝一個管理應用程式才能管理雲端服務。',
        '你可以透過任何現代網頁瀏覽器來管理雲端服務。',
    ],
    211: [
        '你只能從 Windows 裝置管理雲端服務。',
        '你可以從命令列管理雲端服務。',
        '你可以透過網頁瀏覽器管理雲端服務。',
    ],
    223: [
        'Azure Sentinel 會把收集到的事件存放在 Azure 儲存體帳戶中。',
        'Azure Sentinel 可以自動修復事件。',
        'Azure Sentinel 可以從 Azure 虛擬機器收集 Windows Defender 防火牆的記錄。',
    ],
    225: [
        'Azure 防火牆 (Azure Firewall) 會將所有從 Azure 送往網際網路的網路流量加密。',
        '網路安全性群組 (NSG) 會將所有從 Azure 送往網際網路的網路流量加密。',
        '執行 Windows Server 2016 的 Azure 虛擬機器，可以將送往網際網路的網路流量加密。',
    ],
    252: [
        '你可以把網路安全性群組 (NSG) 關聯到虛擬網路的子網路。',
        '你可以把網路安全性群組 (NSG) 關聯到整個虛擬網路。',
        '你可以把網路安全性群組 (NSG) 關聯到網路介面。',
    ],
    258: [
        '你可以建立自訂 Azure 角色來控管資源的存取權。',
        '一個使用者帳戶可以同時被指派多個 Azure 角色。',
        '一個資源群組的擁有者 (Owner) 角色可以指派給多位使用者。',
    ],
    268: [
        'Azure Active Directory (Azure AD) 要求必須在 Azure 虛擬機器上部署網域控制站。',
        'Azure Active Directory (Azure AD) 為裝載在 Azure 與 Microsoft 365 上的資源提供驗證服務。',
        'Azure Active Directory (Azure AD) 裡的每個使用者帳戶只能指派一個授權。',
    ],
    275: [
        '你可以設定讓 Azure Active Directory (Azure AD) 的活動記錄顯示在 Azure 監視器 (Azure Monitor) 中。',
        '透過 Azure 監視器，你可以監視跨多個 Azure 訂用帳戶的資源。',
        '透過 Azure 監視器，你可以建立警示。',
    ],
    285: [
        '信任中心 (Trust Center) 是 Azure 安全中心 (Azure Security Center) 的一部分。',
        '只有擁有 Azure 訂用帳戶的使用者才能存取信任中心 (Trust Center)。',
        '信任中心 (Trust Center) 提供有關 Azure 合規性方案的資訊。',
    ],
    292: [
        '使用 Microsoft 雲端服務帳戶就能存取 Microsoft Service Trust Portal。',
        '合規性管理員 (Compliance Manager) 可以用來追蹤公司與 Microsoft 雲端服務相關的法規遵循活動。',
        '「我的庫」(My Library) 功能可以把 Microsoft Service Trust Portal 的文件與資源集中儲存在同一個地方。',
    ],
    303: [
        '一個 Azure 資源可以同時擁有多個刪除鎖定。',
        '一個 Azure 資源會繼承其所屬資源群組的鎖定。',
        '如果一個 Azure 資源已經有唯讀鎖定，你還可以再為它加上刪除鎖定。',
    ],
    305: [
        '只有 Azure Active Directory (Azure AD) 使用者才能被授權存取 Azure 資源。',
        '儲存在 Azure Active Directory (Azure AD)、第三方雲端服務、以及內部部署 Active Directory 中的身分，都可以用來存取 Azure 資源。',
        'Azure 內建驗證與授權服務，為 Azure 資源提供安全的存取。',
    ],
    308: [
        '單一登入 (SSO) 要求所有使用者都必須用 Microsoft Authenticator 應用程式登入。',
        '驗證 (Authentication) 指的是判斷一個已通過驗證的使用者或服務擁有哪一層級存取權的程序。',
        '條件式存取 (Conditional Access) 會利用登入過程中收集到的訊號，判斷要允許還是拒絕存取要求。',
    ],
    321: [
        'Azure 免費帳戶有支出上限。',
        'Azure 免費帳戶最多只能上傳 2TB 的資料到 Azure。',
        'Azure 免費帳戶可以無限制地建立 Web 應用程式。',
    ],
    330: [
        '在 Azure 入口網站中，你可以分辨出哪些服務已經正式發行 (GA)、哪些還在公開預覽階段。',
        '一項 Azure 服務正式發行 (GA) 之後，就不會再更新新功能。',
        '為公開預覽階段的服務建立 Azure 資源之後，等該服務正式發行 (GA)，你必須重新建立這些資源。',
    ],
    331: [
        '使用 Azure ExpressRoute 連線時，從內部部署網路流向 Azure 的輸入資料流量一律免費。',
        '從 Azure 流向內部部署網路的輸出資料流量一律免費。',
        '同一個 Azure 區域內、Azure 服務之間的資料流量一律免費。',
    ],
    340: [
        '如果公司使用 Azure 免費帳戶，就只能使用一部分的 Azure 服務。',
        '所有 Azure 免費帳戶在特定期間之後都會到期。',
        '同一個 Microsoft 帳戶最多可以建立 10 個 Azure 免費帳戶。',
    ],
    354: [
        '隨用隨付 (PAYG) 是一種依用量計費的模式。',
        '支付給雲端服務供應商的費用視為資本支出 (CapEx)。',
        '透過依用量計費模式提供的服務，視為營運支出 (OpEx)。',
    ],
    358: [
        'Azure 免費帳戶內建 Standard 支援方案。',
        'Premier 支援方案只有簽有企業合約 (EA) 的公司才能購買。',
        'MSDN 論壇的支援，只提供給採用隨用隨付訂用帳戶的公司。',
    ],
    380: [
        '相較於內部部署，雲端運算的資本支出 (CAPEX) 成本較低。',
        '雲端運算提供的組態設定選項，跟內部部署完全相同。',
        '當企業需求變動時，雲端運算可以隨之調整規模。',
    ],
    382: [
        'Azure Functions 是平台即服務 (PaaS) 雲端服務模型的例子。',
        'Microsoft 365 是軟體即服務 (SaaS) 雲端服務模型的例子。',
        'Azure 虛擬機器是基礎設施即服務 (IaaS) 雲端服務模型的例子。',
    ],
    385: [
        '部署在同一個 Azure 區域的 Azure 虛擬網路，預設就會互相連線。',
        '在同一個資源群組中建立的虛擬網路，名稱必須是唯一的。',
        'Azure 虛擬網路的位址空間，在同一個訂用帳戶內必須是唯一的。',
    ],
    394: [
        'Azure 儲存體的封存 (Archive) 存取層可以設定在帳戶層級。',
        '非經常 (Cool) 存取層是 Azure 儲存體中儲存 Blob 成本最低的層級。',
        'Blob 上傳到 Azure 儲存體容器之後，該儲存體帳戶的存取層就可以再變更。',
    ],
    396: [
        '進階儲存體帳戶可以設定為 Azure 檔案共用。',
        '進階儲存體帳戶可以設定為區塊 Blob 儲存體。',
        '進階儲存體帳戶可以設定為 StorageV2 儲存體。',
    ],
    400: [
        '你可以透過 Azure 入口網站部署 Azure 資源管理員 (ARM) 範本。',
        'Azure 資源管理員 (ARM) 範本可以用程式碼來定義基礎設施。',
        '每個要部署的 Azure 資源都需要一個各自獨立的 Azure 資源管理員 (ARM) 範本。',
    ],
    415: [
        'Azure Virtual Desktop 的工作階段主機只能執行 Windows 10 或 Windows 11。',
        '一個包含 20 台工作階段主機的 Azure Virtual Desktop 主機集區，最多只能支援 20 個同時連線的使用者。',
        'Azure Virtual Desktop 支援桌面與應用程式虛擬化。',
    ],
    417: [
        '在同一個 Azure 訂用帳戶中，你可以有兩個名稱相同的 Azure 儲存體帳戶。',
        '在不同的 Azure 區域中，你可以有兩個名稱相同的 Azure 儲存體帳戶。',
        '在兩個不同的 Azure 訂用帳戶中，你可以有兩個名稱相同的 Azure 儲存體帳戶。',
    ],
    418: [
        'Azure 顧問 (Azure Advisor) 提供個人化的建議。',
        'Azure 顧問可以針對虛擬機器提供成本建議。',
        'Azure 顧問可以提供跨多個 Azure 訂用帳戶的建議。',
    ],
    431: [
        'AzCopy 是一個命令列工具，用來將 Blob 或檔案複製到儲存體帳戶、或從儲存體帳戶複製出來。',
        'Azure 儲存體總管 (Azure Storage Explorer) 是一項雲端託管的移轉服務，用來傳輸大量資料。',
        'Azure 檔案同步 (Azure File Sync) 會在 Azure 檔案與 Windows 檔案伺服器之間同步檔案與資料夾。',
    ],
    434: [
        'ExpressRoute 使用邊界閘道協定 (BGP)。',
        'ExpressRoute 是透過網際網路把內部部署網路連接到 Azure 的。',
        '你可以設定多條 ExpressRoute 線路，把內部部署資料中心連接到 Azure。',
    ],
    435: [
        'Azure Arc 可以管理執行 Linux 的實體伺服器。',
        'Azure Arc 可以大規模管理 Azure Kubernetes 服務 (AKS) 叢集。',
        'Azure Arc 可以管理裝載在 Azure 之外的第三方資料庫解決方案。',
    ],
    441: [
        '為虛擬機器增加更多 RAM 是水平擴展 (Horizontal scaling) 的例子。',
        '依需求增加額外的虛擬機器是垂直擴展 (Vertical scaling) 的例子。',
        '水平擴展可以自動或手動進行。',
    ],
    444: [
        'Azure AD 要求必須在 Azure 虛擬機器上部署網域控制站。',
        'Azure AD 為 Azure 與 Microsoft 365 提供驗證服務。',
        'Azure AD 裡的每個使用者帳戶只能指派一個 Microsoft 365 授權。',
    ],
    453: [
        '水平擴展可以自動增加虛擬機器執行個體的數量。',
        '垂直擴展可以自動為虛擬機器配置額外的記憶體。',
        '調整規模可以依服務的需求變化來管理成本。',
    ],
    454: [
        '你可以在 Microsoft Entra 使用者上加上資源鎖定。',
        '你可以在同一台 Azure 虛擬機器上加上多個資源鎖定。',
        '你可以修改一個已經加上刪除鎖定的 Azure 資源的屬性。',
    ],
    465: [
        'Azure 儲存體中的冷 (Cold) 存取層，是為至少 90 天的資料儲存所最佳化的。',
        'Azure 儲存體中的非經常 (Cool) 存取層，是為至少 90 天的資料儲存所最佳化的。',
        'Azure 儲存體中的封存 (Archive) 存取層，是為至少 180 天的資料儲存所最佳化的。',
    ],
}
