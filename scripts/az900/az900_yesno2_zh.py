#!/usr/bin/env python3
"""是非型 HOTSPOT 批次二 —— 35 題（來源格式較亂，不走 extract_items() 自動抽取，
直接手動撰寫，跟 az900_manual.YESNO 同一種形狀）。

這批題目的 PDF AI 解析段（sections['2']）格式比第一批（55 題）雜亂許多——
部份題目的官方答案（sections['4']）本身就跟自己的分析矛盾或被截斷，部份題目的
分析段落整段是 AI 產生失敗的通用樣板文字（"選項1：分析為什麼正確或錯誤"），完全沒有
真實內容。這種情況一律用 render_az900.py 把該題的答案區截圖讀出來，用截圖上標示的
官方答案（綠色/紅框）核對，不采信任何用其他題目或臆測拼湊出來的內容。
"""

YESNO2 = {
    55: {
        'items': [
            ('To implement a hybrid cloud model, a company must have an internal network.', '若要實作混合雲模型，公司必須擁有內部網路。', False,
             '混合雲是結合公用雲與私有／地端環境的架構，但並不強制要求企業必須擁有自有的內部網路；企業也可以透過其他私有連線方式（例如租用的私有雲環境）與公用雲整合，因此擁有內部網路並非實作混合雲的必要條件，此陳述錯誤。'),
            ('A company can extend the computing resources of its internal network by using a hybrid cloud.', '公司可以透過採用混合雲，擴充其內部網路的運算資源。', True,
             '這正是混合雲模式的核心優勢之一：企業可將公用雲的彈性運算能力與地端環境整合，在尖峰需求時動態擴充運算容量，而不必自行採購與維護額外的實體硬體，因此此陳述正確。'),
            ('In a public cloud model, only guest users at your company can access the resources in the cloud.', '在公用雲模型中，只有貴公司內的訪客使用者才能存取雲端中的資源。', False,
             '公用雲資源的存取權限完全由帳戶擁有者透過身分驗證與存取控制機制自行設定，可授權給組織內任何角色的使用者，並不僅限於訪客帳戶，因此此陳述錯誤。'),
        ],
        'full': '此題檢驗混合雲與公用雲的基本概念：混合雲能讓企業彈性擴充運算資源，但不強制要求特定的內部網路架構；而公用雲的存取控制則由帳戶擁有者自行決定，不侷限於訪客使用者。',
    },
    56: {
        'items': [
            ('A Platform as a Service (PaaS) solution provides full control of operating systems that host applications.', '平台即服務 (PaaS) 解決方案可讓使用者完全控制裝載應用程式的作業系統。', False,
             'PaaS 的核心特性是由雲端服務供應商負責管理底層作業系統、修補與執行環境，使用者只需專注於應用程式的開發與部署，並不具備對作業系統的完整控制權；這正是 PaaS 與 IaaS（使用者需自行管理作業系統）的主要差異，因此此陳述錯誤。'),
            ('A Platform as a Service (PaaS) solution provides additional memory to apps by changing pricing tiers.', '平台即服務 (PaaS) 解決方案可透過變更定價層級，為應用程式提供額外的記憶體。', True,
             '以 Azure App Service 等 PaaS 服務為例，使用者可透過升級服務方案（定價層級）取得更多運算資源，包括記憶體、CPU 核心數與執行個體規模等，因此此陳述正確。'),
            ('A Platform as a Service (PaaS) solution can automatically scale the number of instances.', '平台即服務 (PaaS) 解決方案可以自動擴展執行個體的數量。', True,
             'PaaS 服務（例如 Azure App Service）內建自動調整規模功能，能依據流量或資源使用率自動增加或減少執行個體數量，以維持效能並節省成本，因此此陳述正確。'),
        ],
        'full': '此題凸顯 PaaS 的核心特性：供應商代管作業系統、使用者無法完全控制底層系統，但可透過調整定價層級取得更多資源，並享有自動調整規模的彈性。',
    },
    71: {
        'items': [
            ('Microsoft SQL Server 2019 installed on an Azure virtual machine is an example of platform as a service (PaaS).', '安裝在 Azure 虛擬機器上的 Microsoft SQL Server 2019 是平台即服務 (PaaS) 的範例。', False,
             '將 SQL Server 安裝在 Azure 虛擬機器上屬於基礎架構即服務 (IaaS)，因為使用者仍須自行管理虛擬機器的作業系統、修補與 SQL Server 的安裝維護等工作；這與由 Azure 全代管的 PaaS 資料庫服務（如 Azure SQL Database）不同，因此此陳述錯誤。'),
            ('Azure SQL Database is an example of platform as a service (PaaS).', 'Azure SQL Database 是平台即服務 (PaaS) 的範例。', True,
             'Azure SQL Database 是完全受控的雲端資料庫服務，Azure 負責處理底層基礎架構、修補與備份等維運工作，使用者只需專注於資料庫本身的使用與管理，符合 PaaS 的定義，因此此陳述正確。'),
            ('Azure Cosmos DB is an example of software as a service (SaaS).', 'Azure Cosmos DB 是軟體即服務 (SaaS) 的範例。', False,
             'Azure Cosmos DB 是一項全受控、全球分散式的 NoSQL 資料庫服務，屬於 PaaS 而非 SaaS；SaaS 通常指終端使用者可直接使用的完整應用程式（例如 Microsoft 365），因此此陳述錯誤。'),
        ],
        'full': '此題測驗三種雲端服務模型的分辨方式：自行安裝於虛擬機器上的軟體屬於 IaaS，全代管資料庫服務屬於 PaaS，而終端使用者導向的完整應用程式才屬於 SaaS。',
    },
    79: {
        'items': [
            ('You must have physical servers to use cloud computing.', '若要使用雲端運算，你必須擁有實體伺服器。', False,
             '雲端運算的核心理念正是讓使用者無需自行採購與維護實體伺服器，所有硬體資源皆由雲端服務供應商代管，使用者只需透過網路取用運算資源即可，因此此陳述錯誤。'),
            ('You must have internet connectivity to use cloud computing.', '若要使用雲端運算，你必須擁有網際網路連線。', False,
             '雲端運算通常透過網際網路存取公用雲資源，但這並非絕對必要條件；例如私有雲，或透過 ExpressRoute 等專用私人連線存取的環境，即可在不經過公用網際網路的情況下使用雲端運算資源，因此此陳述錯誤。'),
            ('The costs to increase cloud computing capacity are less than the costs to increase the computing capacity of an on-premises datacenter.', '相較於增加地端資料中心的運算容量，擴充雲端運算容量的成本較低。', True,
             '雲端運算採用隨用隨付的計費模式，企業可依實際需求彈性擴充運算資源，不需事先大量投資採購實體硬體、機房空間、電力與冷卻設備；相較之下，擴充地端資料中心容量涉及龐大的資本支出與建置時間，因此雲端擴充成本通常較低，此陳述正確。'),
        ],
        'full': '本題強調雲端運算的彈性與成本優勢：使用者不需自備實體伺服器，也不一定要透過公用網際網路存取，而擴充雲端容量的成本通常遠低於自建地端資料中心。',
    },
    120: {
        'items': [
            ('If you have Azure resources deployed to every region, you can implement availability zones in all the regions.', '若你已在每個區域都部署 Azure 資源，就可以在所有區域中實作可用性區域。', False,
             '並非所有 Azure 區域都支援可用性區域功能，僅特定區域提供此服務；因此即使資源已部署至每個區域，也不代表能在所有區域中啟用可用性區域，此陳述錯誤。'),
            ('Only virtual machines that run Windows Server can be created in availability zones.', '只有執行 Windows Server 的虛擬機器才能建立在可用性區域中。', False,
             '可用性區域支援各種作業系統的虛擬機器，不論是 Windows Server 或 Linux 皆可部署於可用性區域內，並非僅限 Windows Server，因此此陳述錯誤。'),
            ('Availability zones are used to replicate data and applications to multiple regions.', '可用性區域用於將資料與應用程式複寫到多個區域。', False,
             '可用性區域是在同一個 Azure 區域內，跨越多個實體隔離的資料中心提供高可用性保護，主要用於防範單一資料中心故障，而非跨區域複寫資料；跨區域的資料複寫與備援通常透過區域配對或異地備援儲存體等機制達成，因此此陳述錯誤。'),
        ],
        'full': '此題釐清可用性區域的正確用途：其保護範圍限於單一區域內的多個資料中心、支援多種作業系統，但並非所有區域都支援可用性區域，也不是用來做跨區域的資料複寫。',
    },
    121: {
        'items': [
            ('North America is represented by a single Azure region.', '北美地區僅以單一個 Azure 區域來代表。', False,
             '北美地區實際上涵蓋多個 Azure 區域，例如美國東部、美國西部、美國中部及加拿大中部等，並非只有單一區域，因此此陳述錯誤。'),
            ('Every Azure region has multiple datacenters.', '每個 Azure 區域都擁有多個資料中心。', True,
             '為確保高可用性與容錯能力，每個 Azure 區域通常由多個資料中心組成；即使在同一區域內，這些資料中心也可能分屬不同的可用性區域，因此此陳述正確。'),
            ('Data transfers between Azure services located in different Azure regions are always free.', '位於不同 Azure 區域的 Azure 服務之間的資料傳輸一律免費。', False,
             '跨區域的資料傳輸（例如將資料從一個區域傳出至另一個區域）通常會依傳輸流量收取出站頻寬費用，並非一律免費，因此此陳述錯誤。'),
        ],
        'full': '此題測驗 Azure 區域的基本架構：北美涵蓋多個區域、每個區域皆有多個資料中心以確保備援，但跨區域的資料傳輸通常需支付費用。',
    },
    127: {
        'items': [
            ('You can use Availability Zones in Azure to protect Azure virtual machines from a datacenter failure.', '你可以在 Azure 中使用可用性區域，保護 Azure 虛擬機器免於資料中心層級的故障。', True,
             '可用性區域是同一個 Azure 區域內實體位置相互獨立的資料中心，各自擁有獨立的電力、冷卻與網路，跨可用性區域部署虛擬機器可以避免單一資料中心故障造成服務中斷。'),
            ('You can use Availability Zones in Azure to protect Azure virtual machines from a region failure.', '你可以在 Azure 中使用可用性區域，保護 Azure 虛擬機器免於區域層級的故障。', False,
             '可用性區域全部位於同一個 Azure 區域之內，無法防護整個區域發生故障的情況；要防護區域層級的故障，需要搭配異地備援的部署或備份策略。'),
            ('You can use Availability Zones in Azure to protect Azure managed disks from a datacenter failure.', '你可以在 Azure 中使用可用性區域，保護 Azure 受控磁碟免於資料中心層級的故障。', True,
             '受控磁碟也可以跟虛擬機器一起釘選在特定可用性區域，或使用區域備援儲存體 (ZRS) 讓資料同時寫入多個可用性區域，藉此防護單一資料中心故障。'),
        ],
        'full': '可用性區域防護的是同一區域內、不同資料中心層級的故障，不能取代跨區域的容錯移轉需求。',
    },
    139: {
        # 文字層只抽到 1 句陳述，實際上截圖裡有 3 句（見 render_az900.py 139）。
        'items': [
            ('The Total Cost of Ownership (TCO) Calculator displays the cost of running workloads in a datacenter.', '整體擁有成本計算機 (TCO Calculator) 會顯示在資料中心執行工作負載的成本。', True,
             'TCO 計算機的用途正是讓你比較「留在自有資料中心」跟「搬上 Azure」兩種情境的成本，所以它會估算並顯示在資料中心執行工作負載的成本，作為比較基準。'),
            ('The Total Cost of Ownership (TCO) Calculator displays the cost of running workloads in Azure.', '整體擁有成本計算機 (TCO Calculator) 會顯示在 Azure 上執行工作負載的成本。', True,
             '這是 TCO 計算機比較的另一端——把目前的工作負載對應到建議的 Azure 服務後，估算並顯示搬上 Azure 執行的成本，方便跟資料中心的成本互相比較。'),
            ('The Total Cost of Ownership (TCO) Calculator generates graphical reports.', '整體擁有成本計算機 (TCO Calculator) 會產生圖形化報告。', True,
             'TCO 計算機在完成成本比較後，會提供詳細且圖形化的報告，用圖表呈現資料中心與 Azure 之間的成本差異，方便分享與決策。'),
        ],
        'full': '三個陳述都在講 TCO 計算機的功能：估算資料中心成本、估算 Azure 成本，並用圖形化報告呈現比較結果，全部正確。',
    },
    178: {
        'items': [
            ('Azure Advisor can generate a list of Azure virtual machines that are protected by Azure Backup.', 'Azure Advisor 可以產生一份受 Azure Backup 保護的 Azure 虛擬機器清單。', False,
             'Azure Advisor 的建議功能是找出「尚未」受 Azure Backup 保護的虛擬機器，並建議你為其啟用備份，而不是反過來列出已受保護的虛擬機器清單；若要查看哪些虛擬機器已受保護，需要到 Recovery Services 保存庫中檢視受保護的項目，因此此陳述錯誤。'),
            ("If you implement the security recommendations provided by Azure Advisor, your company's secure score will decrease.", '如果你實作 Azure Advisor 提供的安全性建議，貴公司的安全分數將會下降。', False,
             '安全分數是用來衡量目前安全狀態相對於建議設定的指標，採納並實作 Advisor 提出的安全性建議會提升整體安全防護程度，因此安全分數應該會提高而非下降，此陳述所描述的方向相反，故為錯誤。'),
            ('To maintain Microsoft support, you must implement the security recommendations provided by Azure Advisor within a period of 30 days.', '為了維持 Microsoft 支援，你必須在 30 天內實作 Azure Advisor 提供的安全性建議。', False,
             'Azure Advisor 提供的僅是「建議」而非強制性「要求」，是否採用完全由客戶自行決定，Microsoft 並未規定必須在特定期限內完成這些建議才能維持支援服務，因此此陳述錯誤。'),
        ],
        'full': '三則陳述都與 Azure Advisor 的角色有關：它只是提供最佳化與安全性建議的工具，並不會反向列出已受保護的資源，也不具強制力，採納建議只會提升而不會降低安全分數。',
    },
    183: {
        'items': [
            ('Azure Advisor provides recommendations on how to improve the security of an Azure Active Directory (Azure AD) environment.', 'Azure Advisor 會針對如何改善 Azure Active Directory (Azure AD) 環境的安全性提供建議。', True,
             'Azure Advisor 的安全性建議來源是 Microsoft Defender for Cloud 的安全評分與建議，涵蓋範圍包含身分與存取相關的設定（例如啟用多重要素驗證、移除過期的來賓帳戶等），因此確實會涉及 Azure AD 環境的安全性改善建議。'),
            ('Azure Advisor provides recommendations on how to reduce the cost of running Azure virtual machines.', 'Azure Advisor 會針對如何降低執行 Azure 虛擬機器的成本提供建議。', True,
             'Advisor 的「成本」類別會分析虛擬機器的使用率，建議調整大小或關閉閒置的虛擬機器執行個體，藉此降低成本，這是 Advisor 的核心功能之一。'),
            ('Azure Advisor provides recommendations on how to configure the network settings on Azure virtual machines.', 'Azure Advisor 會針對如何設定 Azure 虛擬機器的網路設定提供建議。', False,
             'Advisor 的建議聚焦在成本、效能、可靠性、安全性與卓越營運五大類別的最佳化方向，並不會提供虛擬機器網路設定（例如子網路、NSG 規則細節）的組態指引，這類設定屬於使用者自行管理的範圍。'),
        ],
        'full': '三個陳述分別對應 Advisor 建議涵蓋的範圍：安全性（含 AD 環境）與成本最佳化都在其中，但不包含虛擬機器網路組態的具體設定建議。',
    },
    204: {
        'items': [
            ('Azure PowerShell modules can be installed on macOS.', 'Azure PowerShell 模組可以安裝在 macOS 上。', True,
             'Azure PowerShell（Az 模組）是跨平台工具，基於 PowerShell 7 以上版本建置，可安裝於 Windows、macOS 及 Linux 等多種作業系統，因此此陳述正確。'),
            ('Azure Cloud Shell can be accessed from a web browser on a Linux computer.', 'Azure Cloud Shell 可以透過 Linux 電腦上的網頁瀏覽器存取。', True,
             'Azure Cloud Shell 是內建於瀏覽器的殼層工具，只要能開啟支援的瀏覽器並登入 Azure 入口網站，不論作業系統是 Windows、macOS 還是 Linux 皆可使用，因此此陳述正確。'),
            ('The Azure portal can only be accessed from a Windows device.', 'Azure 入口網站只能從 Windows 裝置存取。', False,
             'Azure 入口網站是以網頁形式提供的圖形化管理介面，只要裝置上有支援的瀏覽器即可存取，並不限定作業系統，因此可在 Windows、macOS、Linux 甚至行動裝置上使用，此陳述錯誤。'),
        ],
        'full': '三則陳述皆在測試對 Azure 管理工具跨平台特性的理解：Azure PowerShell、Cloud Shell 與 Azure 入口網站皆可在 Windows、macOS、Linux 等不同平台上使用，並非僅限 Windows。',
    },
    213: {
        'items': [
            ('Azure Monitor can monitor the performance of on-premises computers.', 'Azure Monitor 可以監控地端電腦的效能。', True,
             '透過在地端電腦安裝 Log Analytics 代理程式（或 Azure Monitor Agent），並將其連接到 Log Analytics 工作區，Azure Monitor 便能蒐集並監控地端伺服器的效能與健康狀態，因此此陳述正確。'),
            ('Azure Monitor can send alerts to Azure Active Directory security groups.', 'Azure Monitor 可以將警示傳送至 Azure Active Directory 安全性群組。', False,
             'Azure Monitor 的警示是透過「動作群組」來設定通知方式，例如電子郵件、簡訊、語音、Webhook、Logic Apps、ITSM 或指定 Azure 角色（如擁有者、參與者、讀者）等，但並不支援直接將警示傳送給 Azure AD 安全性群組本身，因此此陳述錯誤。'),
            ('Azure Monitor can trigger alerts based on data in an Azure Log Analytics workspace.', 'Azure Monitor 可以根據 Azure Log Analytics 工作區中的資料觸發警示。', True,
             'Azure Monitor 支援建立以記錄為基礎的警示規則，透過對 Log Analytics 工作區中儲存的記錄檔資料執行查詢，當結果符合設定的條件時即可觸發警示，這是其核心功能之一，因此此陳述正確。'),
        ],
        'full': '此組陳述測試對 Azure Monitor 監控範圍與警示機制的理解：它可監控地端與雲端資源效能、也能依據 Log Analytics 工作區資料觸發警示，但警示的收件對象是透過動作群組設定的通知管道，而非直接指定 Azure AD 安全性群組。',
    },
    226: {
        'items': [
            ('Azure Security Center can monitor Azure resources and on-premises resources.', 'Azure Security Center 可以監控 Azure 資源與地端資源。', True,
             'Azure Security Center（現稱 Microsoft Defender for Cloud）是一套混合雲安全態勢管理工具，除了可監控 Azure 資源外，還能透過代理程式或 Azure Arc 納管並監控地端及其他雲端環境中的資源，因此此陳述正確。'),
            ('All Azure Security Center features are free.', 'Azure Security Center 的所有功能都是免費的。', False,
             'Azure Security Center 提供免費方案與付費的標準方案兩個層級，免費方案僅包含持續安全性評估、基本建議與安全分數等功能，若要啟用進階威脅偵測、法規合規性儀表板等進階防護功能，則需訂閱付費的標準方案，因此此陳述錯誤。'),
            ('From Azure Security Center, you can download a Regulatory Compliance report.', '在 Azure Security Center 中，你可以下載法規合規性報告。', True,
             'Azure Security Center 提供法規合規性儀表板，能持續評估你的環境是否符合特定法規標準（如 ISO 27001、PCI DSS 等），並允許使用者將合規性狀態匯出成報告以供稽核與存查，因此此陳述正確。'),
        ],
        'full': '此組陳述聚焦於 Azure Security Center（Microsoft Defender for Cloud）的功能範圍：它可同時監控雲端與地端資源、提供合規性報告下載，但並非所有進階防護功能都是免費的，進階威脅偵測等需要升級至付費方案。',
    },
    264: {
        'items': [
            ('Identities stored in an on-premises Active Directory can be synchronized to Azure Active Directory (Azure AD).', '儲存在地端 Active Directory 中的身分識別，可以同步到 Azure Active Directory (Azure AD)。', True,
             '透過 Azure AD Connect（或新版的 Azure AD Connect cloud sync）工具，組織可以將地端 Active Directory Domain Services 中的使用者、群組等身分識別資料同步到 Azure AD，這是實現混合身分架構的核心方式，因此此陳述正確。'),
            ('Identities stored in Azure Active Directory (Azure AD), third-party cloud services, and on-premises Active Directory can be used to access Azure resources.', '儲存在 Azure Active Directory (Azure AD)、第三方雲端服務以及地端 Active Directory 中的身分識別，都可以用來存取 Azure 資源。', True,
             'Azure 支援透過聯盟 (federation) 機制，讓地端 Active Directory 或已建立信任關係的第三方雲端身分提供者也能用來驗證並存取 Azure 資源，並不侷限於只能使用 Azure AD 原生帳戶，因此此陳述正確。'),
            ('Azure has built-in authentication and authorization services that provide secure access to Azure resources.', 'Azure 內建身分驗證與授權服務，可為 Azure 資源提供安全的存取控管。', True,
             'Azure Active Directory 本身就是 Azure 內建的雲端身分識別與存取管理服務，結合角色型存取控制等機制，提供對 Azure 資源的身分驗證與授權功能，確保只有經過驗證且獲得授權的使用者才能存取資源，因此此陳述正確。'),
        ],
        'full': '三則陳述皆在說明 Azure 的混合身分能力：地端身分可同步至 Azure AD，也可透過聯盟機制搭配第三方雲端服務共同存取 Azure 資源，而 Azure AD 本身即提供內建的身分驗證與授權服務。',
    },
    266: {
        'items': [
            ('Azure Advisor supports alerts.', 'Azure Advisor 支援警示（alert）。', True,
             'Azure Advisor 可以與 Azure Monitor 整合，讓你針對新產生的建議事項設定警示規則，以便在有新的最佳化建議時即時收到通知，因此此陳述正確。'),
            ('Azure Advisor recommendations can be filtered by Administrative unit.', 'Azure Advisor 的建議可以依系統管理單位（Administrative unit）進行篩選。', False,
             'Azure Advisor 的建議可依訂用帳戶、資源群組，以及建議類別（例如成本、效能、可靠性、安全性、卓越營運）等條件篩選，但並不支援依「系統管理單位」篩選。系統管理單位是 Microsoft Entra ID（Azure AD）用來委派管理使用者與群組的功能，與 Advisor 的篩選機制無關，因此此陳述錯誤。'),
            ('Azure Advisor provides recommendations on improving the performance of resources.', 'Azure Advisor 提供有關改善資源效能的建議。', True,
             'Azure Advisor 是 Azure 的內建諮詢服務，會分析你的資源設定與使用狀況，並在效能、成本、可靠性、安全性與卓越營運等類別中提出改善建議，其中效能建議協助你找出並解決可能造成效能瓶頸的問題，因此此陳述正確。'),
        ],
        'full': 'Azure Advisor 支援透過 Azure Monitor 設定警示，也會提供效能最佳化建議，但其篩選條件僅限訂用帳戶、資源群組與建議類別，並不支援依系統管理單位篩選。',
    },
    283: {
        'items': [
            ('Azure Active Directory (Azure AD) can be used to manage access to on-premises applications.', 'Azure Active Directory (Azure AD) 可以用來管理內部部署應用程式的存取權限。', True,
             '透過 Azure AD Application Proxy 之類的功能，可以把內部部署的應用程式發佈出來，讓 Azure AD 統一管理其存取權限與驗證，不需要額外建置 VPN。'),
            ('Azure Active Directory (Azure AD) provides single sign-on (SSO).', 'Azure Active Directory (Azure AD) 提供單一登入 (SSO) 功能。', True,
             'SSO 是 Azure AD 的核心功能之一，使用者登入一次後即可存取所有已整合的應用程式，不需要為每個應用程式重複輸入認證。'),
            ('iOS devices can be registered in Azure Active Directory (Azure AD).', 'iOS 裝置可以在 Azure Active Directory (Azure AD) 中註冊。', True,
             'Azure AD 支援跨平台的裝置註冊，包含 Windows、iOS、Android、macOS 等，註冊後可以套用條件式存取原則與裝置合規性管理。'),
        ],
        'full': '三個陳述都在講 Azure AD 的基本能力：存取管理、SSO、跨平台裝置註冊，全部正確。',
    },
    286: {
        'items': [
            ('You can use Azure Policy to enforce tagging rules and conventions.', '你可以使用 Azure Policy 強制執行標籤規則與命名慣例。', True,
             'Azure Policy 可以定義規則，要求資源或資源群組在建立時必須套用特定標籤，或強制標籤值須符合特定慣例，藉此確保組織的標籤治理一致性，因此此陳述正確。'),
            ('A resource or resource group can have a maximum of 50 tags.', '每個資源或資源群組最多可以套用 50 個標籤。', True,
             '根據 Azure 官方文件，每個資源、資源群組或訂用帳戶最多可套用 50 個標籤，這是 Azure 標籤功能既定的數量上限，因此此陳述正確。'),
            ('Tags applied to a resource group or subscription are automatically inherited by the resources within it.', '套用在資源群組或訂用帳戶上的標籤，會自動被其中的資源繼承。', False,
             'Azure 的標籤預設不會在資源、資源群組與訂用帳戶之間自動繼承，也就是說為資源群組加上的標籤並不會自動出現在其內的個別資源上；若要達成類似效果，須另外透過 Azure Policy 的標籤繼承原則來實作，因此此陳述錯誤。'),
        ],
        'full': 'Azure 標籤可透過 Azure Policy 強制規範，且每項資源上限為 50 個標籤，但標籤本身不會在資源群組、訂用帳戶與資源之間自動繼承。',
    },
    295: {
        'items': [
            ('You can create Group Policies in Azure Active Directory (Azure AD).', '你可以在 Azure Active Directory（Azure AD）中建立群組原則（Group Policy）。', False,
             '群組原則（Group Policy）是 Windows Server 傳統 Active Directory 網域服務（AD DS）的功能，用於集中管理網域內電腦與使用者設定。Azure AD 是雲端身分識別服務，並不支援建立傳統群組原則，若需要類似的裝置設定管理，應改用 Microsoft Intune 等裝置管理工具，因此此陳述錯誤。'),
            ('You can join Windows 10 devices to Azure Active Directory (Azure AD).', '你可以將 Windows 10 裝置加入（join）Azure Active Directory（Azure AD）。', True,
             'Windows 10（與更新版本）支援直接加入 Azure AD（Azure AD Join），這是 Azure AD 裝置身分識別的核心功能之一，可讓公司擁有的裝置向 Azure AD 進行驗證，並讓使用者以組織帳戶登入裝置及存取雲端資源，因此此陳述正確。'),
            ('You can join Android devices to Azure Active Directory (Azure AD).', '你可以將 Android 裝置加入（join）Azure Active Directory（Azure AD）。', False,
             'Azure AD Join 目前僅支援 Windows 裝置。Android 與 iOS 等行動裝置只能以「Azure AD 註冊（registered）」的方式新增為個人裝置身分識別，並多半搭配 Microsoft Intune 進行行動裝置管理（MDM），而無法以「加入」的方式成為 Azure AD 裝置，因此此陳述錯誤。'),
        ],
        'full': 'Azure AD 並不提供傳統的群組原則功能；Windows 10 裝置可直接加入 Azure AD，但 Android 裝置僅能以個人裝置身分「註冊」，無法「加入」Azure AD。',
    },
    300: {
        'items': [
            ('General Data Protection Regulation (GDPR) defines data protection and privacy rules.', '一般資料保護規則（GDPR）訂定了資料保護與隱私相關的規範。', True,
             'GDPR 是歐盟制定的資料保護法規，明確規範個人資料的蒐集、處理、儲存與傳輸方式，並賦予個人對其個人資料的多項權利，因此此陳述正確。'),
            ('General Data Protection Regulation (GDPR) applies to companies that offer goods or services to individuals in the EU.', '一般資料保護規則（GDPR）適用於向歐盟境內個人提供商品或服務的公司。', True,
             'GDPR 具有域外效力，不論企業是否設立於歐盟境內，只要該企業向歐盟居民提供商品或服務，或監測其行為，就必須遵循 GDPR 的規範，因此此陳述正確。'),
            ('Azure can be used to build a General Data Protection Regulation (GDPR)-compliant infrastructure.', '你可以使用 Azure 來建置符合 GDPR 規範的基礎架構。', True,
             'Microsoft 提供多項工具與服務（例如 Microsoft Purview、加密機制、存取控制、合規性總管等）協助客戶在 Azure 上建置符合 GDPR 要求的解決方案，且 Azure 本身也已通過相關合規性稽核，因此此陳述正確。'),
        ],
        'full': 'GDPR 是歐盟訂定的個資保護法規，其適用範圍不限於歐盟境內企業，而 Azure 提供充足的工具協助客戶建置符合 GDPR 要求的雲端基礎架構。',
    },
    301: {
        'items': [
            ('You can add an Azure Resource Manager template to an Azure blueprint.', '你可以將 Azure Resource Manager 範本加入 Azure Blueprint 中。', True,
             'Azure Blueprints 支援將 ARM 範本、資源群組、角色指派（RBAC）與原則指派（Policy）等多種成品（artifact）組合成一份藍圖，其中 ARM 範本可用來定義要部署的資源，因此此陳述正確。'),
            ('You can assign an Azure blueprint to a resource group.', '你可以將 Azure Blueprint 指派給資源群組。', False,
             'Azure Blueprint 的指派對象是訂用帳戶，而不是資源群組；藍圖本身可以在其定義中「建立」新的資源群組作為部署目標，但指派動作只能套用在訂用帳戶層級，因此此陳述錯誤。'),
            ('You can use Azure Blueprints to grant permissions to a resource.', '你可以使用 Azure Blueprint 為資源授予存取權限。', True,
             'Azure Blueprint 可包含角色指派（Role Assignment）成品，讓管理員在部署藍圖時同步設定資源的角色型存取控制權限，因此此陳述正確。'),
        ],
        'full': 'Azure Blueprint 可整合 ARM 範本與角色指派等成品，並在訂用帳戶層級（而非資源群組層級）進行指派。',
    },
    302: {
        'items': [
            ('Azure China is operated by Microsoft.', 'Azure China 是由 Microsoft 直接營運。', False,
             'Azure China 是由中國本地合作夥伴世紀互聯（21Vianet）依授權營運，並非由 Microsoft 直接營運，這是因應中國法規要求所採取的獨立營運模式，因此此陳述錯誤。'),
            ('Azure Government is operated by Microsoft.', 'Azure Government 是由 Microsoft 直接營運。', True,
             'Azure Government 是由 Microsoft 員工在美國境內直接營運與維運的獨立雲端環境，提供符合美國聯邦、州與地方政府法規要求的服務，因此此陳述正確。'),
            ('Azure Government is available only to US government agencies and their partners.', 'Azure Government 僅提供給美國政府機關及其合作夥伴使用。', True,
             'Azure Government 是專為美國聯邦、州、地方政府機關以及符合資格的政府合作夥伴與承包商設計的雲端環境，一般企業或其他國家的組織無法申請使用，因此此陳述正確。'),
        ],
        'full': 'Azure China 由世紀互聯（21Vianet）獨立營運而非 Microsoft，而 Azure Government 則是由 Microsoft 直接營運，且僅限美國政府機關及其合作夥伴使用。',
    },
    315: {
        'items': [
            ('Most Azure services are introduced in private preview before being introduced in public preview, and then in general availability.', '大多數 Azure 服務會先進入私有預覽，然後進入公開預覽，最後才正式發行（GA）。', True,
             'Azure 服務通常遵循「私有預覽 → 公開預覽 → 正式發行（GA）」的生命週期。私有預覽僅開放給特定客戶進行評估與意見回饋，公開預覽則開放給所有擁有訂用帳戶的使用者試用，功能穩定後才會正式發行。因此此陳述正確。'),
            ('Azure services in public preview can be managed only by using the Azure CLI.', '處於公開預覽階段的 Azure 服務只能透過 Azure CLI 進行管理。', False,
             '公開預覽階段的服務與正式發行的服務一樣，可以透過 Azure 入口網站、Azure CLI、Azure PowerShell 等多種標準管理工具來管理，並不限定只能使用 Azure CLI。因此此陳述錯誤。'),
            ('The cost of an Azure service in private preview decreases when the service becomes generally available.', 'Azure 服務在私有預覽階段的費用，於服務正式發行（GA）後會下降。', False,
             '處於私有或公開預覽階段的服務通常會以折扣價格甚至免費提供，目的是鼓勵客戶提早試用並回饋意見；服務正式發行後，價格通常會調漲而非調降。因此此陳述錯誤。'),
        ],
        'full': '這三項陳述說明 Azure 服務的生命週期（私有預覽→公開預覽→正式發行）、預覽階段的管理方式與定價變化趨勢。',
    },
    322: {
        'items': [
            ('An Azure service in private preview is released to all Azure customers.', '處於私人預覽 (private preview) 階段的 Azure 服務，會釋出給所有 Azure 客戶使用。', False,
             '私人預覽是限定邀請對象才能使用的階段，通常只開放給特定客戶或需要另外申請加入，並不會釋出給所有 Azure 客戶。'),
            ('An Azure service in public preview is released to all Azure customers.', '處於公開預覽 (public preview) 階段的 Azure 服務，會釋出給所有 Azure 客戶使用。', True,
             '公開預覽階段任何 Azure 客戶都可以自行選擇啟用該功能試用，不需要額外的邀請或審核，因此確實是開放給所有客戶。'),
            ('An Azure service in general availability is released to a subset of Azure customers.', '已正式發行 (general availability) 的 Azure 服務，只會釋出給部分 Azure 客戶使用。', False,
             '正式發行代表該服務已經穩定，並開放給所有 Azure 客戶正式使用，而不是只釋出給部分客戶，限定對象的做法是預覽階段才有的性質。'),
        ],
        'full': '服務生命週期的開放對象隨階段擴大：私人預覽（受邀對象）到公開預覽（所有客戶可自行試用）到正式發行（所有客戶皆可用），沒有一個階段是限定部分客戶。',
    },
    336: {
        'items': [
            ('Adding resource groups in an Azure subscription generates additional costs.', '在 Azure 訂用帳戶中新增資源群組會產生額外費用。', False,
             '資源群組只是用來組織與管理 Azure 資源的邏輯容器，本身並非計費資源，建立資源群組不會產生任何費用；只有群組內實際部署的資源才會計費。因此此陳述錯誤。'),
            ('Copying 10 GB of data to Azure from an on-premises network over a VPN generates additional Azure data transfer costs.', '透過 VPN 將 10 GB 的資料從內部部署網路複製到 Azure，會產生額外的 Azure 資料傳輸費用。', False,
             '這屬於資料輸入（ingress，即資料「進入」Azure）的行為。Azure 對於透過 VPN 或網際網路傳入的資料一律不收取傳輸費用，因此此陳述錯誤。'),
            ('Copying 10 GB of data from Azure to an on-premises network over a VPN generates additional Azure data transfer costs.', '透過 VPN 將 10 GB 的資料從 Azure 複製到內部部署網路，會產生額外的 Azure 資料傳輸費用。', True,
             '這屬於資料輸出（egress，即資料「離開」Azure）的行為。Azure 依標準頻寬定價針對輸出的資料傳輸收費，因此此陳述正確。'),
        ],
        'full': '資源群組本身不計費，Azure 對外傳出（egress）的資料傳輸會收費，傳入（ingress）則免費。',
    },
    356: {
        'items': [
            ('All Azure services in private preview must be accessed by using a separate Azure portal.', '所有處於私有預覽階段的 Azure 服務，都必須透過另一個獨立的 Azure 入口網站存取。', False,
             '私有預覽功能仍是在一般的 Azure 入口網站中檢視與使用，使用者只需先註冊或受邀取得存取權限，並不需要透過另一個獨立的入口網站。因此此陳述錯誤。'),
            ('Azure services in public preview can be used in production environments.', '處於公開預覽階段的 Azure 服務可以用於正式環境（production）。', True,
             '使用者可以在正式環境中使用公開預覽服務，但須自行承擔風險，因為這類服務可能不穩定、不受 SLA 保障，且功能隨時可能變更或被撤回而不另行通知。因此此陳述正確。'),
            ('Azure services in public preview are subject to a Service Level Agreement (SLA).', '處於公開預覽階段的 Azure 服務受服務等級協定（SLA）保障。', False,
             '公開預覽階段的服務並不包含在 SLA 保障範圍內，某些情況下甚至不提供官方支援，只有服務正式發行（GA）後才會受 SLA 約束。因此此陳述錯誤。'),
        ],
        'full': '公開預覽服務可在正式環境試用但不受 SLA 保障，私有預覽功能仍在一般入口網站中、僅需先取得存取權限即可。',
    },
    360: {
        'items': [
            ('A user who is assigned the Owner role can transfer ownership of an Azure subscription.', '被指派為擁有者（Owner）角色的使用者，可以轉移 Azure 訂用帳戶的擁有權。', False,
             '轉移訂用帳戶擁有權需要該訂用帳戶所屬計費帳戶的計費管理員（Billing Administrator）或全域管理員（Global Administrator）權限，而不是單純的訂用帳戶 Owner 角色。Owner 角色可管理訂用帳戶內的資源與存取權限，但無法轉移整個訂用帳戶的擁有權。因此此陳述錯誤。'),
            ('You can convert the Azure subscription of your company from Free Trial to Pay-As-You-Go.', '你可以將公司的 Azure 訂用帳戶從免費試用（Free Trial）轉換為隨用隨付（Pay-As-You-Go）。', True,
             'Azure 允許使用者隨時將免費試用訂用帳戶升級轉換為隨用隨付方案，以便在試用額度或期限結束後持續使用服務，這是常見且受支援的操作。因此此陳述正確。'),
            ('The Azure spending limit is fixed and cannot be increased or decreased.', 'Azure 的消費限制（spending limit）是固定的，無法調高或調低。', True,
             '消費限制的金額等於帳戶本身的信用額度，這個金額無法被調高或調低；使用者唯一能做的調整是完全移除消費限制，移除後訂用帳戶就會變成沒有上限，而不是把限制改成其他金額。因此此陳述正確。'),
        ],
        'full': '轉移訂用帳戶需要計費／全域管理員權限（非單純 Owner）；免費試用可升級為隨用隨付；消費限制金額固定、只能整個移除、無法調整為其他數值。',
    },
    366: {
        'items': [
            ('By creating additional resource groups in an Azure subscription, additional costs are incurred.', '在 Azure 訂用帳戶中建立額外的資源群組，會產生額外的費用。', False,
             '資源群組本身只是用來組織與管理資源的邏輯容器，建立資源群組不會產生任何費用，只有群組裡實際部署的資源才會計費。'),
            ('By copying several gigabits of data to Azure from an on-premises network over a VPN, additional data transfer costs are incurred.', '透過 VPN 從內部部署網路將數 GB 的資料複製到 Azure，會產生額外的資料傳輸費用。', False,
             '資料傳入 (ingress) Azure 一律不收費，不論透過網際網路或 VPN 連線傳入多少資料，這部分不會產生額外的資料傳輸費用。'),
            ('By copying several GB of data from Azure to an on-premises network over a VPN, additional data transfer costs are incurred.', '透過 VPN 將數 GB 的資料從 Azure 複製到內部部署網路，會產生額外的資料傳輸費用。', True,
             '資料傳出 (egress) Azure 是要計費的，即使是透過 VPN 連線傳出，超過免費額度後仍會依資料傳輸量計算費用。'),
        ],
        'full': '費用重點在方向：資料傳入 Azure 免費，傳出 Azure（egress）才會計費；資源群組本身則完全不計費。',
    },
    373: {
        'items': [
            ('Only one tag can be assigned to an Azure resource.', '一個 Azure 資源只能被指派一個標籤（tag）。', False,
             'Azure 資源可以同時指派多個標籤，每個標籤都是由索引鍵與值組成的名稱/值配對，用來對資源進行分類、篩選與成本追蹤，並沒有只能指派單一標籤的限制。因此此陳述錯誤。'),
            ('Tags can be assigned to Azure resources by using Azure Resource Manager (ARM) templates.', '可以透過 Azure Resource Manager（ARM）範本將標籤指派給 Azure 資源。', True,
             'ARM 範本支援在部署資源時於資源定義中加入 tags 屬性，藉此在建立資源的同時自動指派標籤，這是常見的自動化與治理做法。因此此陳述正確。'),
            ('Tags can be used to enforce naming standards for Azure resources.', '標籤可以用來強制執行 Azure 資源的命名標準。', False,
             '標籤的用途是分類、組織資源以及進行成本管理與查詢，本身不具強制力；若要強制要求資源遵循特定命名規則，應改用 Azure Policy 來定義並強制執行命名規範。因此此陳述錯誤。'),
        ],
        'full': '標籤可多個指派、可透過 ARM 範本設定，用於分類與成本管理，但命名標準的強制執行需仰賴 Azure Policy 而非標籤本身。',
    },
    379: {
        'items': [
            ('Microsoft Defender for Cloud can monitor Azure resources and on-premises resources.', 'Microsoft Defender for Cloud 可以監視 Azure 資源與內部部署資源。', True,
             'Defender for Cloud 支援混合環境，透過 Azure Arc 之類的機制可以把內部部署與其他雲端的伺服器也納入監視範圍，並不侷限於 Azure 資源本身。'),
            ('All Microsoft Defender for Cloud features are free.', 'Microsoft Defender for Cloud 的所有功能都是免費的。', False,
             'Defender for Cloud 分成免費的基礎安全態勢管理，與需要付費的 Defender 方案，進階威脅偵測等功能需要額外付費啟用，並非全部免費。'),
            ('For Microsoft Defender for Cloud, you can download a Regulatory Compliance report.', '在 Microsoft Defender for Cloud 中，你可以下載法規遵循性報告。', True,
             'Defender for Cloud 的法規遵循儀表板可以針對套用的法規標準（如 ISO 27001、PCI DSS）產生並下載合規性報告，方便稽核使用。'),
        ],
        'full': '這題內容跟第 226 題幾乎一樣，只是把服務舊名「Azure Security Center」換成新名稱「Microsoft Defender for Cloud」，本質是同一個服務改名前後的版本。',
    },
    416: {
        'items': [
            ('In an Azure virtual machine scale set, the virtual machines are configured identically.', '在 Azure 虛擬機器擴展集中，其中的虛擬機器會採用相同的組態設定。', True,
             '虛擬機器擴展集的核心設計就是讓一群執行個體使用同一份組態範本，包含作業系統映像、大小與網路設定等，以確保所有執行個體一致並可輕鬆水平擴充。因此此陳述正確。'),
            ('The number of Azure virtual machines in a virtual machine scale set can increase automatically.', '虛擬機器擴展集中的虛擬機器數量可以自動增加。', True,
             '虛擬機器擴展集支援自動調整規模功能，可依據 CPU 使用率、記憶體用量或排程等規則，在負載升高時自動新增執行個體。因此此陳述正確。'),
            ('The number of Azure virtual machines in a virtual machine scale set can decrease automatically.', '虛擬機器擴展集中的虛擬機器數量可以自動減少。', True,
             '虛擬機器擴展集同樣支援自動縮減規模，當負載降低時可依規則自動移除多餘的執行個體，藉此節省成本並最佳化資源使用。因此此陳述正確。'),
        ],
        'full': '虛擬機器擴展集能提供組態一致的執行個體集合，並依據負載自動增減數量，是 Azure 中實現彈性水平擴展的核心服務。',
    },
    428: {
        'items': [
            ('The Hot access tier is available for blob data that uses standard storage.', '熱 (Hot) 存取層適用於使用標準儲存體的 Blob 資料。', True,
             'Hot、Cool、Archive 三種存取層是標準一般用途 v2 儲存體帳戶中 Blob 儲存體所提供的功能，用來依存取頻率最佳化成本。Hot 層專為經常存取的資料設計，因此此陳述正確。'),
            ('The Cool access tier is available for file shares in premium storage.', 'Cool 存取層適用於高階儲存體中的檔案共用。', False,
             '存取層（Hot/Cool/Archive）僅適用於標準儲存體帳戶中的 Blob 資料，並不適用於檔案共用，更不適用於高階（Premium）儲存體；高階檔案共用採用的是效能層級而非存取層概念。因此此陳述錯誤。'),
            ('The Cool access tier can be configured at the storage account level.', 'Cool 存取層可以在儲存體帳戶層級進行設定。', True,
             '使用者可以在建立或修改儲存體帳戶時，將預設存取層設定為 Hot 或 Cool，此設定會套用至帳戶中未個別指定存取層的 Blob，也可針對個別 Blob 另行覆寫。因此此陳述正確。'),
        ],
        'full': '此組陳述說明 Azure Blob 儲存體存取層的適用範圍與設定層級：存取層僅限標準儲存體的 Blob 資料，且可在帳戶層級或個別 Blob 層級設定。',
    },
    440: {
        'items': [
            ('Creating and configuring a virtual network is part of the platform as a service (PaaS) cloud service model.', '建立與設定虛擬網路屬於平台即服務 (PaaS) 雲端服務模型的一部分。', False,
             '建立與設定虛擬網路這類基礎設施層級的工作，屬於基礎設施即服務 (IaaS) 的責任範圍；PaaS 模型下，網路基礎設施是由平台代管，使用者不需要自行建立與設定虛擬網路。'),
            ("In the platform as a service (PaaS) cloud service model, updating code for an Azure web app is the customer's responsibility.", '在平台即服務 (PaaS) 雲端服務模型中，更新 Azure Web 應用程式的程式碼是客戶的責任。', True,
             '在 PaaS 模型的責任共擔架構中，平台（作業系統、執行環境等）由 Microsoft 代管，但應用程式本身的程式碼開發與更新，永遠是客戶的責任。'),
            ("Configuring user access to a platform as a service (PaaS) cloud service model is the customer's responsibility.", '設定平台即服務 (PaaS) 雲端服務模型的使用者存取權限是客戶的責任。', True,
             '不論哪一種雲端服務模型，資料與存取權限的管理永遠是客戶的責任，PaaS 也不例外，客戶要自行設定誰可以存取應用程式與相關資料。'),
        ],
        'full': '責任共擔模型的判斷依據：基礎設施層（虛擬網路）在 PaaS 下由平台負責，但應用程式碼與存取權限管理，任何服務模型下都是客戶的責任。',
    },
    462: {
        'items': [
            ('Microsoft Purview provides data backup.', 'Microsoft Purview 提供資料備份功能。', False,
             'Microsoft Purview 是一項資料治理與資料目錄服務，專注於資料探索、分類與合規性管理，並不提供資料備份功能；備份相關需求應使用 Azure Backup 等服務。因此此陳述錯誤。'),
            ('Microsoft Purview provides data discovery.', 'Microsoft Purview 提供資料探索功能。', True,
             'Microsoft Purview 的核心功能之一即為統一資料目錄與資料探索，可自動掃描並識別組織內跨雲端、跨系統的資料資產，協助使用者了解資料的所在位置與內容。因此此陳述正確。'),
            ('Microsoft Purview provides data classification.', 'Microsoft Purview 提供資料分類功能。', True,
             'Microsoft Purview 可依據內建與自訂的分類規則，自動辨識並標記資料的敏感性與類型（例如信用卡號、個資等），協助組織進行資料治理與合規性管理。因此此陳述正確。'),
        ],
        'full': 'Microsoft Purview 是資料治理平台，專注於資料探索與分類，而非資料備份，備份需另外透過 Azure Backup 等服務達成。',
    },
    463: {
        'items': [
            ('Azure DNS only supports public DNS domain names.', 'Azure DNS 僅支援公用 DNS 網域名稱。', False,
             'Azure DNS 除了可以裝載公用 DNS 區域之外，也提供 Azure Private DNS，讓使用者可以在虛擬網路內管理私人網域名稱解析，而不對外公開。因此「僅支援公用網域名稱」的說法錯誤。'),
            ('Azure virtual machines can register names in Azure DNS automatically.', 'Azure 虛擬機器可以自動在 Azure DNS 中註冊名稱。', False,
             '自動註冊虛擬機器名稱是 Azure Private DNS 區域搭配虛擬網路連結時才有的功能，並非公用 Azure DNS 服務本身具備的能力；公用 DNS 區域中的記錄必須由使用者手動建立與管理。因此此陳述錯誤。'),
            ('Azure DNS can host a custom DNS domain.', 'Azure DNS 可以裝載自訂 DNS 網域。', True,
             '使用者可以將自己擁有的網域名稱轉移至 Azure DNS 進行裝載與管理，Azure DNS 支援建立與管理該網域的各類 DNS 記錄。因此此陳述正確。'),
        ],
        'full': 'Azure DNS 同時支援公用與私人網域裝載，但虛擬機器名稱的自動註冊僅限於 Private DNS 區域的整合功能，並非公用 DNS 服務的預設行為。',
    },
    468: {
        'items': [
            ('A read-only lock prevents users from deleting an Azure resource.', '唯讀鎖定會阻止使用者刪除 Azure 資源。', True,
             '唯讀（Read-only）鎖定會將資源鎖定為唯讀狀態，使用者無法修改或刪除該資源，因此也必然會阻止刪除操作。此陳述正確。'),
            ('Users can modify an Azure resource that has a delete lock applied.', '被套用刪除鎖定的 Azure 資源，使用者仍可以修改它。', True,
             '刪除（Delete）鎖定只會阻止資源被刪除，並不會限制對資源內容的修改，因此使用者仍然可以正常更新該資源的設定。此陳述正確。'),
            ('All Azure resources inherit the locks assigned to their parent resource group.', '所有 Azure 資源都會繼承套用在其父資源群組上的鎖定。', True,
             '資源鎖定會沿著範圍階層向下套用，若鎖定套用於資源群組，該群組內的所有資源都會自動繼承此鎖定，即使子資源本身未直接設定鎖定。因此此陳述正確。'),
        ],
        'full': '資源鎖定分為唯讀與刪除兩種類型，兩者的限制範圍不同，且鎖定會由資源群組向下繼承至個別資源。',
    },
}
