#!/usr/bin/env python3
"""HOTSPOT「完成句子」批次二 —— 25 題。

跟第一批（72 題，走 az900_sentence_auto.py 自動抽取）不同，這批來源格式較亂
（許多題目沒有給出原始填空句、選項常混雜「Correct Answer:」等雜訊區塊），
直接手動撰寫成 az900_manual.CHOICE 同一種形狀，build_choice() 不用改。

6 題來源解析完全沒有真實選項內容（只有「其他選項（未顯示具體內容）」這種
樣板文字），改用 render_az900.py 截圖答案區下拉選單，核對圖上標示的官方答案
後手動撰寫（id 129/267/333/424/432/471）。
"""

SENTENCE2 = {
    85: {
        'stem_zh': '某組織部署了 Azure Web App(公有雲服務),並將其與內部部署 (on-premises) 的 Microsoft SQL Server 資料庫結合使用。此情境屬於哪一種雲端部署模型?',
        'stem_en': 'An organization deploys an Azure Web App (a public cloud service) that connects to an on-premises Microsoft SQL Server database. Which cloud deployment model does this scenario represent?',
        'options': {
            'A': ('Hybrid cloud', '混合雲 (Hybrid Cloud)'),
            'B': ('Multi-vendor cloud', '多供應商雲 (Multi-vendor Cloud)'),
            'C': ('Private cloud', '私有雲 (Private Cloud)'),
            'D': ('Public cloud', '公有雲 (Public Cloud)'),
        },
        'answer': ['A'],
        'explanations': {
            'A': '混合雲是結合公有雲服務與內部部署或私有雲環境的部署模型。此情境中 Azure Web App 屬於公有雲服務,而 Microsoft SQL Server 執行於內部部署環境,兩者結合正符合混合雲的定義。',
            'B': '多供應商雲是指同時使用多個公有雲服務供應商(例如 Azure 與 AWS)的服務,但題目僅涉及 Azure 與內部部署環境的結合,並未使用多個雲端供應商,因此不符合。',
            'C': '私有雲是專屬於單一組織、通常架設於內部部署或專用資料中心的雲端環境。題目中的 Azure Web App 是公有雲服務,不符合私有雲的定義。',
            'D': '公有雲僅指由第三方供應商透過網際網路提供、向大眾開放的雲端服務。此情境同時涉及公有雲服務與內部部署環境,並非純粹的公有雲情境,因此不正確。',
        },
    },
    86: {
        'stem_zh': 'Azure 提供一項受控 (managed) 的 SQL Server 資料庫服務,其軟體更新由 Azure 負責處理,使用者無需管理底層作業系統,只需專注於應用程式開發。這描述的是哪一種雲端服務模型?',
        'stem_en': 'Azure offers a managed SQL Server database in which software updates are handled by Azure, allowing users to focus on application development without managing the underlying operating system. Which cloud service model does this describe?',
        'options': {
            'A': ('Disaster recovery as a service (DRaaS)', '災難復原即服務 (Disaster Recovery as a Service, DRaaS)'),
            'B': ('Infrastructure as a service (IaaS)', '基礎設施即服務 (Infrastructure as a Service, IaaS)'),
            'C': ('Platform as a service (PaaS)', '平台即服務 (Platform as a Service, PaaS)'),
            'D': ('Software as a service (SaaS)', '軟體即服務 (Software as a Service, SaaS)'),
        },
        'answer': ['C'],
        'explanations': {
            'A': '災難復原即服務主要提供資料備份與災難復原能力,與題目描述的受控資料庫服務並無直接關聯,因此不正確。',
            'B': '基礎設施即服務僅提供虛擬機器、儲存體與網路等基礎資源,使用者仍須自行管理作業系統與軟體更新。題目中軟體更新由 Azure 負責處理,不符合 IaaS 的特性。',
            'C': '平台即服務提供受控的執行環境,雲端供應商負責管理底層作業系統與軟體更新,使用者只需專注於應用程式與資料庫的使用。受控的 SQL Server 資料庫正是典型的 PaaS 服務,因此正確。',
            'D': '軟體即服務是指供應商提供完整、可直接使用的應用程式,終端使用者無需了解底層架構。SQL Server 資料庫是提供給開發者使用的平台服務,而非終端使用者應用程式,因此不符合 SaaS 的定義。',
        },
    },
    89: {
        'stem_zh': '以下哪一項 Azure 儲存體服務支援使用 SMB 通訊協定,在內部部署 (on-premises) 儲存體與 Azure 之間進行同步?',
        'stem_en': 'Which Azure storage service supports synchronization between on-premises storage and Azure using the SMB protocol?',
        'options': {
            'A': ('Azure Blob Storage', 'Azure Blob 儲存體 (Azure Blob Storage)'),
            'B': ('Azure Files', 'Azure 檔案儲存體 (Azure Files)'),
            'C': ('Azure Queue Storage', 'Azure 佇列儲存體 (Azure Queue Storage)'),
            'D': ('Azure Table Storage', 'Azure 資料表儲存體 (Azure Table Storage)'),
        },
        'answer': ['B'],
        'explanations': {
            'A': 'Azure Blob 儲存體是一種物件儲存解決方案,主要用於儲存非結構化資料(例如圖片、影片、備份檔案),本身並不提供與內部部署儲存體之間的檔案同步功能。',
            'B': 'Azure 檔案儲存體提供完全受控的檔案共用服務,支援透過 SMB(以及 NFS)通訊協定掛接,並可透過 Azure File Sync 與內部部署伺服器之間進行雙向同步,因此是正確答案。',
            'C': 'Azure 佇列儲存體是一種訊息佇列服務,用於在應用程式元件之間傳遞與儲存訊息,與儲存體同步功能無關。',
            'D': 'Azure 資料表儲存體是一種 NoSQL 結構化資料儲存服務,用於儲存索引鍵/值形式的資料,並不支援與內部部署儲存體同步。',
        },
    },
    115: {
        'stem_zh': '請完成下列句子:儲存於 Azure 儲存體帳戶封存存取層 (Archive access tier) 中的資料______。',
        'stem_en': 'Complete the following statement: Data that is stored in the Archive access tier of an Azure Storage account ____.',
        'options': {
            'A': ('can be accessed at any time by using azcopy.exe', '可以隨時使用 azcopy.exe 存取'),
            'B': ('can only be read by using Azure Backup', '只能透過 Azure 備份 (Azure Backup) 讀取'),
            'C': ('must be restored before the data can be accessed', '必須先還原 (restore) 才能存取'),
            'D': ('must be rehydrated before the data can be accessed', '必須先重新水合 (rehydrate) 才能存取'),
        },
        'answer': ['D'],
        'explanations': {
            'A': '封存層中的資料屬於離線狀態,無法直接存取,即使使用 azcopy.exe 等傳輸工具,仍必須先完成重新水合程序才能讀取資料,因此此描述不正確。',
            'B': '資料存取的限制取決於儲存層本身的特性,而非特定工具。Azure 備份是一種備份解決方案,與封存層資料能否被讀取並無直接關聯,因此不正確。',
            'C': '雖然「還原」與「重新水合」概念相近,但在 Azure 儲存體的正式術語中,將封存層資料轉移至可存取狀態的程序稱為「重新水合 (rehydration)」,而非「還原」,因此此選項用詞不準確。',
            'D': '封存存取層是離線儲存層,資料必須先透過重新水合程序轉移至熱 (Hot) 或冷 (Cool) 存取層,才能被讀取或修改,因此此描述正確。',
        },
    },
    129: {
        'stem_zh': '支援最多 20 個執行個體的雲端服務，比只支援最多 5 個執行個體的服務更具有下列哪一項特性？',
        'stem_en': 'A cloud service that supports a maximum of 20 instances is more ___ than a service that supports a maximum of five instances. Which term correctly completes the sentence?',
        'options': {
            'A': ('distributed', '分散式'),
            'B': ('scalable', '可擴充性'),
            'C': ('secure', '安全性'),
        },
        'answer': ['B'],
        'explanations': {
            'A': '分散式描述的是架構是否跨多個節點運作，跟能支援多少執行個體沒有直接關係，服務可以是分散式架構卻仍然只支援少量執行個體。',
            'B': '可擴充性 (scalability) 指的正是服務能夠依需求增加或減少執行個體數量的能力；能支援的執行個體上限越高，代表這項服務的可擴充程度越高。',
            'C': '安全性跟服務能支援多少執行個體完全無關，題目描述的是規模調整的能力，不是防護能力。',
        },
    },
    146: {
        'stem_zh': '請完成下列句子:一個 Azure 區域 (region) ______。',
        'stem_en': 'Complete the following statement: An Azure region ____.',
        'options': {
            'A': ('contains one or more data centers that are connected by using a low-latency network', '包含一個或多個透過低延遲網路連接的資料中心'),
            'B': ('is found in each country where Microsoft has a subsidiary office', '存在於微軟設有子公司的每一個國家'),
            'C': ('can be found in every country in Europe and the Americas only', '僅存在於歐洲和美洲的每一個國家'),
            'D': ('contains one or more data centers that are connected by using a high-latency network', '包含一個或多個透過高延遲網路連接的資料中心'),
        },
        'answer': ['A'],
        'explanations': {
            'A': 'Azure 區域的定義即為由一個或多個資料中心組成,這些資料中心透過專用的低延遲網路互相連接,以確保區域內服務具有最佳的效能與可靠性,此描述正確。',
            'B': 'Azure 區域的部署與微軟是否在該國設有子公司或辦事處無關,許多設有微軟辦公室的國家並沒有 Azure 區域,因此此描述不正確。',
            'C': 'Azure 區域遍布全球,除歐洲與美洲外,亞洲、非洲、澳洲及中東等地區也都設有 Azure 區域,因此此描述過於侷限而不正確。',
            'D': 'Azure 區域內的資料中心是透過低延遲網路連接,而非高延遲網路,高延遲會影響效能與可靠性,因此此描述不正確。',
        },
    },
    210: {
        'stem_zh': '你想要將內部部署 (on-premises) 或多雲環境中的伺服器註冊到 Azure，並以 Azure 資源的方式進行統一管理，應該使用哪一項服務?',
        'stem_en': 'Which Azure service lets you register on-premises or multi-cloud servers so they can be managed as Azure resources?',
        'options': {
            'A': ('Azure AD Connect', 'Azure AD Connect'),
            'B': ('Azure Arc', 'Azure Arc'),
            'C': ('Azure Pipelines Agent', 'Azure Pipelines 代理程式'),
            'D': ('Azure VPN Gateway', 'Azure VPN 閘道 (VPN Gateway)'),
        },
        'answer': ['B'],
        'explanations': {
            'A': 'Azure AD Connect 用於同步內部部署 Active Directory 與 Azure AD 之間的身分識別資訊，並非用來將伺服器註冊為 Azure 資源以進行管理。',
            'B': 'Azure Arc 可讓你將內部部署、其他雲端或邊緣環境中的伺服器、Kubernetes 叢集等資源延伸並註冊到 Azure，以單一控制平面統一進行管理與治理。',
            'C': 'Azure Pipelines 代理程式是用來執行 CI/CD 建置與部署工作的執行環境，與將伺服器納入 Azure 資源管理無關。',
            'D': 'Azure VPN 閘道用於在 Azure 虛擬網路與內部部署網路之間建立加密的 VPN 連線，並不提供將伺服器註冊為可管理 Azure 資源的功能。',
        },
    },
    236: {
        'stem_zh': '「Azure Policy 提案 (initiative) 定義」指的是下列何者?',
        'stem_en': 'An Azure Policy initiative definition is best described as which of the following?',
        'options': {
            'A': ('collection of policy definitions', '原則定義 (policy definitions) 的集合'),
            'B': ('collection of Azure Policy definition assignments', 'Azure Policy 定義指派 (assignments) 的集合'),
            'C': ('group of Azure Blueprints definitions', 'Azure Blueprints 定義的群組'),
            'D': ('group of role-based access control (RBAC) role assignments', '角色型存取控制 (RBAC) 角色指派的群組'),
        },
        'answer': ['A'],
        'explanations': {
            'A': 'Azure Policy 的提案 (initiative) 定義就是將多個原則定義依照特定目標或用途分組而成的集合，方便以單一項目統一管理與指派一組相關原則。',
            'B': '原則指派 (policy assignment) 是把原則定義套用到特定範圍（例如訂用帳戶或資源群組）的動作，並非提案定義本身的內容，因此不正確。',
            'C': 'Azure Blueprints 是用來定義並部署一組資源（如角色指派、原則、資源範本等）的封裝工具，屬於不同的服務，與 Azure Policy 提案定義的概念不同。',
            'D': 'RBAC 角色指派用於管理使用者對資源的存取權限，與 Azure Policy 的提案定義（原則集合）無關。',
        },
    },
    238: {
        'stem_zh': '你想要透過及時 (Just-In-Time, JIT) 虛擬機器存取功能，鎖定虛擬機器的輸入流量以降低受攻擊的風險，應該使用哪一項服務?',
        'stem_en': "Which Azure service provides just-in-time (JIT) virtual machine access to reduce your VMs' exposure to attacks?",
        'options': {
            'A': ('Azure Bastion', 'Azure Bastion'),
            'B': ('Azure Firewall', 'Azure 防火牆 (Azure Firewall)'),
            'C': ('Azure Front Door', 'Azure Front Door'),
            'D': ('Microsoft Defender for Cloud', 'Microsoft Defender for Cloud'),
        },
        'answer': ['D'],
        'explanations': {
            'A': 'Azure Bastion 提供透過瀏覽器安全連線至虛擬機器的 RDP/SSH 存取，但本身並不具備依需求鎖定連接埠、開放存取的 JIT 功能。',
            'B': 'Azure 防火牆是用來保護虛擬網路資源的網路防火牆服務，負責流量過濾與規則管理，並非提供 JIT VM 存取的功能。',
            'C': 'Azure Front Door 是全域負載平衡與應用程式交付服務，用於加速並保護 Web 應用程式流量，與 JIT VM 存取無關。',
            'D': 'Microsoft Defender for Cloud 提供 JIT 虛擬機器存取功能，預設鎖定虛擬機器的輸入流量，僅在需要時依核准開放特定連接埠與時間範圍的存取，藉此降低攻擊面。',
        },
    },
    239: {
        'stem_zh': '你想要使用監管合規性儀表板來檢視資源的合規狀態，並下載合規性報告與驗證報告，應該使用哪一項服務?',
        'stem_en': 'Which Azure service provides a regulatory compliance dashboard where you can download compliance and certification reports?',
        'options': {
            'A': ('Azure Advisor', 'Azure Advisor'),
            'B': ('Azure Analysis Services', 'Azure Analysis Services'),
            'C': ('Azure Monitor', 'Azure 監視器 (Azure Monitor)'),
            'D': ('Microsoft Defender for Cloud', 'Microsoft Defender for Cloud'),
        },
        'answer': ['D'],
        'explanations': {
            'A': 'Azure Advisor 提供成本、安全性、效能與可靠性等方面的最佳做法建議，並不提供監管合規性報告。',
            'B': 'Azure Analysis Services 是用於建立企業級語意資料模型、協助商業智慧分析的服務，與合規性報告無關。',
            'C': 'Azure 監視器用於收集、分析 Azure 資源的效能與健康狀態資料並產生警示，但不提供監管合規性儀表板或合規報告。',
            'D': 'Microsoft Defender for Cloud 提供監管合規性儀表板，協助你了解目前環境是否符合各項法規標準，並可下載 PDF/CSV 格式的合規性報告與驗證報告。',
        },
    },
    241: {
        'stem_zh': '你想要為企業應用程式啟用單一登入 (SSO) 功能，應該使用哪一項服務?',
        'stem_en': 'Which service can you use to enable single sign-on (SSO) for an enterprise application?',
        'options': {
            'A': ('Application security groups in Azure', 'Azure 應用程式安全性群組 (Application Security Groups)'),
            'B': ('Azure Active Directory (Azure AD)', 'Azure Active Directory (Azure AD)'),
            'C': ('Azure Key Vault', 'Azure Key Vault'),
            'D': ('Microsoft Defender for Cloud', 'Microsoft Defender for Cloud'),
        },
        'answer': ['B'],
        'explanations': {
            'A': '應用程式安全性群組是網路安全性群組 (NSG) 規則的邏輯分組工具，可依應用程式結構將虛擬機器分組並套用網路安全性原則，與單一登入功能無關。',
            'B': 'Azure Active Directory (Azure AD) 提供身分識別與存取管理功能，可讓你為企業應用程式設定並啟用單一登入 (SSO)，使使用者以同一組身分存取多個應用程式。',
            'C': 'Azure Key Vault 用於集中管理與保護加密金鑰、憑證與機密資訊，並不提供單一登入功能。',
            'D': 'Microsoft Defender for Cloud 是雲端安全態勢管理與工作負載保護的解決方案，用於強化資源安全性，與設定應用程式單一登入無關。',
        },
    },
    245: {
        'stem_zh': '請完成下列句子:若要允許 TCP 連接埠 8080 的輸入 (inbound) 連線到達 Azure 虛擬機器,你應該設定下列何者?',
        'stem_en': 'Complete the following statement: To allow inbound connections on TCP port 8080 to an Azure virtual machine, you should configure a(n) ____.',
        'options': {
            'A': ('network security group (NSG)', '網路安全性群組 (Network Security Group, NSG)'),
            'B': ('virtual network gateway', '虛擬網路閘道 (Virtual Network Gateway)'),
            'C': ('virtual network', '虛擬網路 (Virtual Network)'),
            'D': ('route table', '路由表 (Route Table)'),
        },
        'answer': ['A'],
        'explanations': {
            'A': '網路安全性群組可讓你建立安全規則,允許或拒絕進出 Azure 資源的網路流量;若要開放 TCP 連接埠 8080 的連線,只需在 NSG 中新增一則輸入安全規則,指定連接埠、通訊協定與來源,因此此選項正確。',
            'B': '虛擬網路閘道用於建立 Azure 虛擬網路與內部部署網路或其他虛擬網路之間的連線(例如透過 VPN 或 ExpressRoute),並非用來管理個別虛擬機器的連接埠規則。',
            'C': '虛擬網路只是定義 Azure 資源所在的私人網路範圍與定址空間,本身並不具備以連接埠為基礎篩選流量的能力。',
            'D': '路由表用於控制虛擬網路中子網路的流量路由走向,而非用來允許或拒絕特定連接埠的流量,因此不符合題意。',
        },
    },
    267: {
        'stem_zh': '貴公司導入下列哪一項服務，可以自動為包含信用卡資訊的 Microsoft Word 文件加上浮水印？',
        'stem_en': 'Your company implements ___ to automatically add a watermark to Microsoft Word documents that contain credit card information. Which service correctly completes the sentence?',
        'options': {
            'A': ('Azure policies', 'Azure 原則 (Azure Policy)'),
            'B': ('DDoS protection', 'DDoS 防護'),
            'C': ('Azure Information Protection', 'Azure 資訊保護 (Azure Information Protection)'),
            'D': ('Azure Active Directory (Azure AD) Identity Protection', 'Azure Active Directory (Azure AD) Identity Protection'),
        },
        'answer': ['C'],
        'explanations': {
            'A': 'Azure Policy 是用來強制 Azure 資源的組態與合規性規則，不會檢查文件內容或加上浮水印，跟保護 Office 文件內容無關。',
            'B': 'DDoS Protection 保護的是網路服務免於分散式阻斷服務攻擊，跟文件內容分類或加浮水印完全無關。',
            'C': 'Azure Information Protection 可以自動偵測文件中的敏感資訊（例如信用卡卡號），依照分類規則加上標籤、浮水印或加密保護，正是題目描述的功能。',
            'D': 'Identity Protection 專注於偵測與回應帳戶風險（例如異常登入），不會檢查文件內容或加上浮水印。',
        },
    },
    325: {
        'stem_zh': '請完成下列句子:某應用程式相依於兩項服務等級協定 (SLA) 分別為 99.95% 與 99.99% 的 Azure 服務,該應用程式的複合 SLA 為下列何者?',
        'stem_en': 'Complete the following statement: An application depends on two Azure services with individual SLAs of 99.95 percent and 99.99 percent. The compound SLA for the application is ____.',
        'options': {
            'A': ('the product of both SLAs, which equals 99.94 percent', '兩個 SLA 的乘積,即 99.94%'),
            'B': ('the lowest SLA associated to the application, which is 99.95 percent', '應用程式所關聯的最低 SLA,即 99.95%'),
            'C': ('the highest SLA associated to the application, which is 99.99 percent', '應用程式所關聯的最高 SLA,即 99.99%'),
            'D': ('the difference between the two SLAs, which is 0.05 percent', '兩個 SLA 之間的差值,即 0.05%'),
        },
        'answer': ['A'],
        'explanations': {
            'A': '當應用程式依序相依於多個各自獨立的服務時,複合 SLA 是將各服務的 SLA 相乘計算,因此 99.95% × 99.99% ≈ 99.94%,正確反映出整體可用性會低於任一單一服務的 SLA。',
            'B': '複合 SLA 並非直接採用最低的單一服務 SLA;由於服務彼此相依,整體可用性會比任何單一服務的 SLA 都低,因此 99.95% 並非正確結果。',
            'C': '複合 SLA 也不是取最高的單一服務 SLA;若只取最高值會高估整體系統的可用性,忽略了服務相依所帶來的額外風險。',
            'D': '複合 SLA 的計算方式是相乘而非相減,直接計算兩者差值並不能反映服務相依對整體可用性的影響,因此不正確。',
        },
    },
    333: {
        'stem_zh': '你可以使用下列哪一項功能，以邏輯方式將物件分組，藉此依部門回報成本並追蹤預算？',
        'stem_en': 'You can use ___ to group objects logically for reporting departmental costs and tracking budgets. Which feature correctly completes the sentence?',
        'options': {
            'A': ('Azure Policy', 'Azure 原則 (Azure Policy)'),
            'B': ('Azure Service Health', 'Azure Service Health'),
            'C': ('resource tags', '資源標籤'),
            'D': ('security groups', '安全性群組'),
        },
        'answer': ['C'],
        'explanations': {
            'A': 'Azure Policy 用來強制資源符合組織的組態與合規性規則，並不是設計來做成本分組與預算追蹤的工具。',
            'B': 'Service Health 顯示的是 Azure 服務本身的健康狀態與規劃性維護事件，跟資源分組或成本報告無關。',
            'C': '資源標籤讓你以鍵值配對的方式為資源加上自訂中繼資料（例如部門、環境、成本中心），可以用來邏輯分組資源，方便依部門篩選成本報表與追蹤預算，正是題目描述的用法。',
            'D': '安全性群組（無論是 Azure AD 安全性群組或網路安全性群組）是用來管理存取權限或網路流量規則，跟成本報告分組無關。',
        },
    },
    344: {
        'stem_zh': '請完成下列句子:處於公開預覽 (Public Preview) 階段的 Azure 服務會是下列何者?',
        'stem_en': 'Complete the following statement: Azure services that are in the Public Preview release stage are ____.',
        'options': {
            'A': ('provided without any documentation', '不提供任何文件'),
            'B': ('only configurable from Azure CLI', '僅能透過 Azure CLI 設定'),
            'C': ('excluded from the Service Level Agreements', '不受服務等級協定 (SLA) 保障'),
            'D': ('only configurable from the Azure portal', '僅能透過 Azure 入口網站設定'),
        },
        'answer': ['C'],
        'explanations': {
            'A': '即使服務處於公開預覽階段,微軟通常仍會提供相對應的文件,協助使用者了解與評估新功能,因此本選項不正確。',
            'B': '公開預覽階段的服務通常可透過多種方式設定與管理,包括 Azure 入口網站、Azure CLI、PowerShell 等,並不侷限於單一工具。',
            'C': '公開預覽讓具備適當授權的客戶可以評估新功能,微軟雖然會在此階段提供客戶支援服務,但一般的服務等級協定並不適用於處於此階段的服務,因此此選項正確。',
            'D': '與選項 B 相同,公開預覽服務並非只能透過 Azure 入口網站設定,實際上可透過多種管理工具進行設定。',
        },
    },
    345: {
        'stem_zh': '如果 Azure 虛擬機器的狀態是「已停止（解除配置）」(Stopped (deallocated))，你仍然需要繼續支付下列哪一項費用？',
        'stem_en': 'If an Azure virtual machine has a status of Stopped (deallocated), you will continue to pay for which of the following?',
        'options': {
            'A': ('compute capacity', '運算容量'),
            'B': ('I/O operations', 'I/O 作業'),
            'C': ('networking', '網路'),
            'D': ('storage', '儲存體'),
        },
        'answer': ['D'],
        'explanations': {
            'A': '虛擬機器解除配置後，Azure 會釋放底層的運算資源，運算費用（依虛擬機器大小計費的核心小時）會立即停止計算。',
            'B': '儲存體交易（I/O 作業）的費用會隨磁碟的實際讀寫次數計費，虛擬機器停止後幾乎不會再有 I/O 活動，這不是持續產生的主要費用項目。',
            'C': '虛擬機器解除配置後不再執行也不再傳輸網路流量，因此不會產生網路相關費用。',
            'D': '解除配置只釋放運算資源，虛擬機器的作業系統磁碟與資料磁碟（受控磁碟）並未被刪除，磁碟仍依配置的容量持續計費，所以儲存體費用會繼續產生。',
        },
    },
    346: {
        'stem_zh': '請完成下列句子:若要查閱說明 Microsoft 透過線上服務 (Microsoft Online Services) 所蒐集之個人資料、其處理方式及用途的文件,你應該參閱下列何者?',
        'stem_en': 'Complete the following statement: To find the document that explains what personal data Microsoft collects through Microsoft Online Services, how it processes that data, and for what purposes, you should refer to the ____.',
        'options': {
            'A': ('Microsoft Online Services Privacy Statement', 'Microsoft 線上服務隱私權聲明 (Microsoft Online Services Privacy Statement)'),
            'B': ('Microsoft Product Terms', 'Microsoft 產品條款 (Microsoft Product Terms)'),
            'C': ('Microsoft Online Service Level Agreement', 'Microsoft 線上服務等級協定 (Microsoft Online Service Level Agreement)'),
            'D': ('Online Subscription Agreement for Microsoft Azure', 'Microsoft Azure 線上訂閱合約 (Online Subscription Agreement for Microsoft Azure)'),
        },
        'answer': ['A'],
        'explanations': {
            'A': '隱私權聲明明確說明 Microsoft 會處理哪些個人資料、如何處理,以及處理這些資料的目的,完全符合題目所描述的內容,因此為正確答案。',
            'B': '產品條款主要說明 Microsoft 各項產品與服務的授權條款及使用規範,並非聚焦於個人資料的蒐集與處理方式。',
            'C': '線上服務等級協定 (SLA) 說明的是服務可用性的承諾與未達標時的補償措施,與個人資料處理方式無關。',
            'D': 'Azure 線上訂閱合約規範的是訂閱本身的條款與條件(例如付款、續約等),同樣不是說明個人資料處理方式的文件。',
        },
    },
    347: {
        'stem_zh': '你應該使用哪一個管理入口網站來存取「合規性管理員 (Compliance Manager)」？',
        'stem_en': 'Which management portal should you use to access Compliance Manager?',
        'options': {
            'A': ('Azure Active Directory admin center', 'Azure Active Directory 系統管理中心'),
            'B': ('Azure portal', 'Azure 入口網站 (Azure Portal)'),
            'C': ('Microsoft 365 admin center', 'Microsoft 365 系統管理中心'),
            'D': ('Microsoft Service Trust Portal', 'Microsoft 服務信任入口網站 (Microsoft Service Trust Portal)'),
        },
        'answer': ['C'],
        'explanations': {
            'A': 'Azure Active Directory 系統管理中心主要用於管理身分識別與存取相關設定，例如使用者、群組與應用程式，並非用來存取合規性管理員。',
            'B': 'Azure 入口網站是管理 Azure 資源與服務的主要介面，但合規性管理員屬於 Microsoft 365 服務的功能，並非透過 Azure 入口網站存取。',
            'C': '合規性管理員是 Microsoft 365 合規性中心所提供的功能，你可以透過 Microsoft 365 系統管理中心進入合規性中心，找到並使用合規性管理員儀表板。',
            'D': 'Microsoft 服務信任入口網站提供的是 Microsoft 雲端服務的合規性報告、稽核報告等資訊，本身並不是用來存取合規性管理員的入口。',
        },
    },
    414: {
        'stem_zh': '下列哪一個選項可以正確完成這個句子：儲存在 Azure 儲存體封存 (Archive) 存取層中的資料 ___？',
        'stem_en': 'Which statement correctly completes the following sentence: Data stored in the Archive access tier of Azure Storage ___?',
        'options': {
            'A': ('can be accessed at any time by using azcopy.exe', '可以隨時使用 azcopy.exe 存取'),
            'B': ('can only be read by using Azure Backup', '只能透過 Azure 備份 (Azure Backup) 讀取'),
            'C': ('must be restored before the data can be accessed', '必須先「還原」才能存取'),
            'D': ('must be rehydrated before the data can be accessed', '必須先進行「重新水化 (rehydrate)」才能存取'),
        },
        'answer': ['D'],
        'explanations': {
            'A': '封存層中的資料處於離線儲存狀態，無法直接讀取，即使使用 azcopy.exe 這類傳輸工具也一樣，必須先變更存取層才能存取資料。',
            'B': 'Azure 備份是資料備份與還原的服務，與封存層資料能否被讀取的機制無關；封存層資料的存取限制與所使用的備份工具無關。',
            'C': '「還原」一詞聽起來相近，但 Azure 儲存體對封存層資料所使用的正式術語是「重新水化 (rehydrate)」，而不是「還原 (restore)」。',
            'D': '封存層的資料處於離線狀態，必須先執行重新水化程序，將資料轉移到經常性存取層或不常存取層等線上存取層後，才能被讀取或修改。',
        },
    },
    424: {
        'stem_zh': '下列哪一項特性可確保在服務發生故障時，仍然能夠存取雲端資源？',
        'stem_en': '___ ensures access to cloud resources in the event of a service failure. Which term correctly completes the sentence?',
        'options': {
            'A': ('High availability', '高可用性'),
            'B': ('Predictability', '可預測性'),
            'C': ('Reliability', '可靠性'),
            'D': ('Scalability', '可擴充性'),
        },
        'answer': ['A'],
        'explanations': {
            'A': '高可用性描述的正是系統在元件或服務發生故障時，仍然能持續運作並提供資源存取的能力，通常透過備援設計（例如可用性區域、負載平衡）來達成，正是題目描述的特性。',
            'B': '可預測性通常用來描述成本或效能表現是否穩定可預期，跟服務故障時是否仍能存取資源沒有直接關係。',
            'C': '可靠性描述系統長時間穩定運作、不易發生錯誤的程度，比較偏向整體品質指標，跟故障當下仍可存取這個更精確的高可用性定義有區別。',
            'D': '可擴充性描述的是依需求增減資源規模的能力，跟服務故障時能否持續存取資源無關。',
        },
    },
    432: {
        'stem_zh': '下列哪一項服務是用來以快速、低成本又可靠的方式，透過實體裝置搬移大量資料？',
        'stem_en': '___ is a physical migration service used to transfer large amounts of data in a quick, inexpensive, and reliable way. Which service correctly completes the sentence?',
        'options': {
            'A': ('Azure Data Box', 'Azure Data Box'),
            'B': ('Azure Databricks', 'Azure Databricks'),
            'C': ('Azure File Sync', 'Azure File Sync'),
            'D': ('Azure Migrate', 'Azure Migrate'),
        },
        'answer': ['A'],
        'explanations': {
            'A': 'Azure Data Box 是 Microsoft 提供的實體儲存裝置，可以把大量（TB 到 PB 等級）的資料離線裝載後寄送到 Azure 資料中心完成匯入，適合網路頻寬不足以在合理時間內完成線上傳輸的情境。',
            'B': 'Azure Databricks 是以 Apache Spark 為基礎的巨量資料分析平台，用來執行資料工程與機器學習工作負載，並不是資料搬遷服務。',
            'C': 'Azure File Sync 是用來將地端伺服器的檔案伺服器與 Azure 檔案共用同步的服務，並非用來一次性搬移大量資料的實體裝置服務。',
            'D': 'Azure Migrate 是用來評估與遷移地端伺服器、應用程式到 Azure 的中樞工具，但它本身是規劃與協調遷移的平台，不是實體資料搬運裝置。',
        },
    },
    456: {
        'stem_zh': '與正常運作時間 99.9% 的服務相比，正常運作時間達 99.999% 的服務具備哪一項更高的特性？',
        'stem_en': 'Compared with a service that has an uptime of 99.9%, a service with an uptime of 99.999% has a higher level of which characteristic?',
        'options': {
            'A': ('availability', '可用性 (Availability)'),
            'B': ('elasticity', '彈性 (Elasticity)'),
            'C': ('manageability', '可管理性 (Manageability)'),
            'D': ('scalability', '可擴充性 (Scalability)'),
        },
        'answer': ['A'],
        'explanations': {
            'A': '可用性是指服務在特定期間內能持續正常運作、提供服務的比例。正常運作時間 99.999%（俗稱「五個 9」）代表服務的中斷時間遠少於 99.9%，因此可用性更高。',
            'B': '彈性是指服務能依據負載自動增加或減少資源的能力，這與服務正常運作時間的高低沒有直接關聯。',
            'C': '可管理性是指服務容易被設定、監控與維運的程度，與正常運作時間的百分比無直接關係。',
            'D': '可擴充性是指系統透過增加或減少資源來因應工作負載變化的能力，並非以正常運作時間百分比來衡量。',
        },
    },
    459: {
        'stem_zh': '下列哪一個選項可以正確完成這個句子：Azure 虛擬網路互連 (Virtual Network Peering) 可以連接 ___？',
        'stem_en': 'Which statement correctly completes the sentence: Azure virtual network peering can connect ___?',
        'options': {
            'A': ('two virtual networks in the same Azure region only', '僅限同一個 Azure 區域內的兩個虛擬網路'),
            'B': ('two virtual networks in the same resource group only', '僅限同一個資源群組內的兩個虛擬網路'),
            'C': ('two virtual networks in the same Azure subscription only', '僅限同一個 Azure 訂用帳戶內的兩個虛擬網路'),
            'D': ('any two virtual networks', '任何兩個虛擬網路'),
        },
        'answer': ['D'],
        'explanations': {
            'A': '虛擬網路互連並不限制在同一個區域內，Azure 也支援跨區域的全域虛擬網路互連 (Global VNet Peering)，因此此選項不正確。',
            'B': '虛擬網路互連不要求兩個虛擬網路位於同一個資源群組，可以跨資源群組建立連線。',
            'C': '虛擬網路互連可以跨訂用帳戶建立，只要具備適當的權限，不同訂用帳戶下的虛擬網路也能互連。',
            'D': '只要具備必要的權限設定，任何兩個虛擬網路都可以透過虛擬網路互連建立直接連線，無論它們位於相同或不同的區域、資源群組或訂用帳戶。',
        },
    },
    471: {
        'stem_zh': '如果你在資料存放未滿 30 天前，就將資料從下列哪一個儲存選項中刪除，必須支付提前刪除費用？',
        'stem_en': 'If you delete data from ___ before 30 days has elapsed, you must pay an early deletion fee. Which storage option correctly completes the sentence?',
        'options': {
            'A': ('an Azure Cosmos DB datastore', 'Azure Cosmos DB 資料存放區'),
            'B': ('Azure SQL Database', 'Azure SQL 資料庫'),
            'C': ('the cool access tier of Azure Blob Storage', 'Azure Blob 儲存體的冷存取層 (cool tier)'),
            'D': ('the hot access tier of Azure Blob Storage', 'Azure Blob 儲存體的熱存取層 (hot tier)'),
        },
        'answer': ['C'],
        'explanations': {
            'A': 'Azure Cosmos DB 是以要求單位與儲存用量計費的資料庫服務，並沒有最短保留天數與提前刪除費用的概念。',
            'B': 'Azure SQL Database 是以運算與儲存資源計費的關聯式資料庫服務，同樣沒有依保留天數收取提前刪除費用的機制。',
            'C': 'Blob 儲存體的冷存取層設有 30 天的最短資料保留期限，若資料在存放未滿 30 天前就被刪除或移到其他層級，就會被收取提前刪除費用；這是冷層與封存層為了鼓勵長期存放而設計的計費規則。',
            'D': '熱存取層設計給頻繁存取的資料使用，沒有最短保留期限的限制，隨時刪除都不會產生提前刪除費用。',
        },
    },
}
