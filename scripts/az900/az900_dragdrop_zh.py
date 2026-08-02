#!/usr/bin/env python3
"""DRAG DROP，18 題（這批的最乾淨子集，累計 373 / 474）。

DRAG DROP 題目的原始拖曳配對只存在於截圖裡，但 PDF 文字層的「§3 我的
答案」段落，對這批而言剛好留下了一份完整、乾淨的「詞 -> 描述」或
「詞: 描述」清單（AI 解析在寫結論時把配對關係重新打了一遍），所以不需要
讀圖，直接從文字重建。

三種子類型：
  ・matching（13 題）：把詞彙拖到對應的描述／情境。
  ・ordering（3 題）：把選項排出正確順序（LRS→ZRS→GRS 這種）。
  ・multiple（2 題）：從清單裡選出所有符合條件的項目（支援方案、
    Azure Government 的合格客戶類型）。

解析是我自己寫的——§2 的逐項分析在這批問題裡格式太亂（跟目標欄位混在
一起、夾雜 Box/選項編號雜訊），比對比自動抽取更容易出錯，所以改成
根據配對本身（都是 AZ-900 基礎知識點）直接寫解析，跟 az900_manual.py
的 CHOICE／YESNO 是同一種做法。
"""

# ── matching：{qid: {'stem_zh','stem_en','pairs':[(term_en, term_zh, desc_en, desc_zh, explain_zh), ...]}} ──
MATCHING = {
    54: {
        'stem_zh': '請把下列雲端服務效益拖到對應的正確描述。',
        'stem_en': 'Match the Azure services benefits to the correct descriptions.',
        'pairs': [
            ('Fault tolerance', '容錯 (Fault tolerance)',
             'A cloud service that remains available after a failure occurs',
             '故障發生後仍能維持可用的雲端服務',
             '容錯指的是元件故障時，服務不中斷、繼續運作——依賴的是備援設計（例如多執行個體），而不是事後才復原。'),
            ('Disaster recovery', '災害復原 (Disaster recovery)',
             'A cloud service that can be recovered after a failure occurs',
             '故障發生後可以被復原的雲端服務',
             '災害復原指的是故障「發生之後」把服務恢復過來，強調的是復原流程與時間，跟容錯「故障當下就不中斷」是不同層次的保護。'),
            ('Dynamic scalability', '動態可調整規模 (Dynamic scalability)',
             'A cloud service that performs quickly when demand increases',
             '需求增加時仍能快速回應的雲端服務',
             '動態可調整規模是依需求自動增減資源，確保流量升高時效能不會下降。'),
            ('Low latency', '低延遲 (Low latency)',
             'A cloud service that can be accessed quickly from the Internet',
             '能從網際網路快速存取的雲端服務',
             '低延遲講的是使用者到服務之間的回應速度，常透過就近部署（例如 CDN、多區域）來達成。'),
        ],
    },
    80: {
        'stem_zh': '請把下列雲端運算效益拖到對應的正確描述。',
        'stem_en': 'Match the cloud computing benefits to the correct descriptions.',
        'pairs': [
            ('Agility', '敏捷性 (Agility)',
             'Applications can be developed, tested, and launched rapidly',
             '應用程式可以快速開發、測試並上線',
             '敏捷性強調的是「速度」——雲端讓你不用等硬體採購，就能快速建置、測試、部署應用程式。'),
            ('Scalability', '可調整規模性 (Scalability)',
             'Resources can be provisioned dynamically to meet changing demands',
             '資源可以依變動的需求動態佈建',
             '可調整規模性講的是資源量能隨需求增減，不管是往上加還是往下減。'),
            ('Geo-distribution', '地理分散 (Geo-distribution)',
             'Applications and data can be deployed to multiple regions',
             '應用程式與資料可以部署到多個區域',
             '地理分散讓你把應用程式和資料放到全球多個區域，使用者就近存取，同時也提升容錯能力。'),
        ],
    },
    124: {
        'stem_zh': '請把下列 Azure 物聯網服務拖到對應的正確描述。',
        'stem_en': 'Match the Azure IoT service to the correct description.',
        'pairs': [
            ('IoT Hub', 'Azure IoT Hub',
             'A managed service that provides bidirectional communication between IoT devices and Azure',
             '提供物聯網裝置與 Azure 之間雙向通訊的受控服務',
             'IoT Hub 是雲端與裝置之間的訊息樞紐，負責雙向通訊、裝置管理與安全連線。'),
            ('IoT Central', 'Azure IoT Central',
             'A fully managed software as a service (SaaS) solution to connect, monitor, and manage IoT devices at scale',
             '大規模連接、監視與管理物聯網裝置的完全受控 SaaS 解決方案',
             'IoT Central 是建立在 IoT Hub 之上的 SaaS 應用程式，提供現成的儀表板，不需要自己開發後端就能管理裝置。'),
            ('Azure Sphere', 'Azure Sphere',
             'A software and hardware solution that provides communication and security features for IoT devices',
             '為物聯網裝置提供通訊與安全功能的軟硬體整合解決方案',
             'Azure Sphere 包含客製化微控制器、客製化 Linux 作業系統與安全服務三個部分，鎖定的是裝置端的安全性。'),
        ],
    },
    138: {
        'stem_zh': '請把下列 Azure 治理功能拖到對應的正確描述。',
        'stem_en': 'Match the Azure governance feature to the correct description.',
        'pairs': [
            ('Azure Policy', 'Azure 原則 (Azure Policy)',
             'Restrict which virtual machine types can be created in a subscription.',
             '限制訂用帳戶中可以建立哪些虛擬機器類型。',
             'Azure 原則用來強制執行規則、限制資源的設定方式（例如限制 VM 大小、地區），確保符合合規要求。'),
            ('Azure Tags', 'Azure 標記 (Azure Tags)',
             'Identify Azure resources that are associated with specific cost centers.',
             '標示出跟特定成本中心相關聯的 Azure 資源。',
             '標記是附加在資源上的「名稱／值」中繼資料，最常見的用途就是依部門或成本中心分類資源、方便帳單分析。'),
            ('Azure Blueprints', 'Azure 藍圖 (Azure Blueprints)',
             'Deploy a complete Azure application environment including resources configuration and role assignments.',
             '部署一整套完整的 Azure 應用程式環境，包含資源設定與角色指派。',
             '藍圖把資源群組、原則、角色指派、範本包裝成一套可重複部署的組合，用來快速建立符合標準的環境。'),
        ],
    },
    243: {
        'stem_zh': '請把下列身分驗證相關術語拖到對應的正確定義。',
        'stem_en': 'Match the term to the correct definition.',
        'pairs': [
            ('authorization', '授權 (authorization)',
             'The process of identifying the access level of a user or service',
             '判定使用者或服務擁有哪一層級存取權的程序',
             '授權發生在身分確認「之後」，決定這個身分能做什麼、能存取哪些資源。'),
            ('multi-factor authentication (MFA)', '多重要素驗證 (MFA)',
             'Requires several elements to identify a user or a service',
             '需要多項要素才能確認使用者或服務身分',
             'MFA 要求至少兩種不同類別的驗證因素（你知道的、你有的、你本身的），單一密碼外洩也無法直接登入。'),
            ('single sign-on (SSO)', '單一登入 (SSO)',
             'The ability to use the same credentials to access multiple resources and applications from different providers',
             '用同一組憑證就能存取來自不同提供者的多個資源與應用程式',
             'SSO 讓使用者登入一次，就能存取所有信任該身分提供者的應用程式，不用每個系統各登入一次。'),
        ],
    },
    426: {
        'stem_zh': '請把下列雲端運算效益拖到對應的正確需求描述。',
        'stem_en': 'Match the cloud computing benefit to the correct requirement.',
        'pairs': [
            ('Elasticity', '彈性 (Elasticity)',
             'The ability to dynamically scale the resources available to a cloud app',
             '動態調整雲端應用程式可用資源量的能力',
             '彈性強調的是「量」的動態調整——用量增加就擴展、用量減少就釋放。'),
            ('Disaster recovery', '災害復原 (Disaster recovery)',
             'The ability to use cloud-based backup services to restore resources in the event of an outage',
             '在服務中斷時，利用雲端備份服務復原資源的能力',
             '災害復原著重在「中斷之後」怎麼把服務與資料復原回來，通常搭配備份與異地備援策略。'),
            ('Agility', '敏捷性 (Agility)',
             'The ability to quickly deploy and configure cloud-based resources as app requirements change',
             '當應用程式需求改變時，能快速部署與設定雲端資源的能力',
             '敏捷性講的是「速度」——需求一變，資源馬上就能跟著調整、部署，不必等待採購或建置流程。'),
        ],
    },
    94: {
        'stem_zh': '請把下列描述拖到對應的正確雲端運算效益。',
        'stem_en': 'Match the description to the correct cloud computing benefit.',
        'pairs': [
            ('Scalability', '可調整規模性 (Scalability)',
             'Increase the compute capacity of apps in the cloud',
             '增加雲端應用程式的運算容量',
             '這裡指的是垂直或水平增加運算資源量，正是可調整規模性的定義。'),
            ('High availability', '高可用性 (High availability)',
             'Provide a continuous user experience with no apparent downtime',
             '提供不中斷、使用者感覺不到停機的持續體驗',
             '高可用性的重點是「持續運作」，靠備援設計把停機時間降到最低。'),
            ('Geo-distribution', '地理分散 (Geo-distribution)',
             'Ensure that users always have the best experience by deploying apps to all the regions where there are users',
             '把應用程式部署到所有有使用者的區域，確保使用者都有最佳體驗',
             '地理分散讓應用程式跟著使用者所在位置就近部署，降低延遲、提升體驗。'),
        ],
    },
    137: {
        'stem_zh': '請把下列無伺服器解決方案拖到對應的正確特性。',
        'stem_en': 'Match the serverless solution to the correct characteristic.',
        'pairs': [
            ('Azure Functions', 'Azure Functions',
             'Executes code', '執行程式碼',
             'Azure Functions 是事件驅動的無伺服器計算服務，核心用途就是執行一段程式碼。'),
            ('Azure Logic Apps', 'Azure Logic Apps',
             'Is always stateful', '一律具備狀態 (stateful)',
             'Logic Apps 內建工作流程狀態管理，執行過程中的狀態會被持久化保存，這點跟預設無狀態的 Functions 不同。'),
            ('Azure Logic Apps', 'Azure Logic Apps',
             'Runs only in the cloud', '只能在雲端執行',
             'Logic Apps 是完全雲端託管的工作流程服務；相較之下 Azure Functions 還可以透過容器等方式在雲端以外執行。'),
        ],
    },
    149: {
        'stem_zh': '請把下列雲端服務拖到對應的正確服務模型。',
        'stem_en': 'Match the cloud service to the correct service model.',
        'pairs': [
            ('Azure App Service', 'Azure App Service',
             'Platform as a service (PaaS)', '平台即服務 (PaaS)',
             'App Service 讓你直接部署程式碼、不用管理底層作業系統與伺服器，是典型的 PaaS。'),
            ('Azure virtual machines', 'Azure 虛擬機器',
             'Infrastructure as a service (IaaS)', '基礎設施即服務 (IaaS)',
             '虛擬機器把運算資源以「機器」的形式交給你，作業系統、修補、組態全部由你自己管理，是典型的 IaaS。'),
            ('Microsoft Dynamics 365', 'Microsoft Dynamics 365',
             'Software as a service (SaaS)', '軟體即服務 (SaaS)',
             'Dynamics 365 是可以直接訂閱使用的完整商業應用程式，不需要部署或維護任何底層元件，是典型的 SaaS。'),
        ],
    },
    169: {
        'stem_zh': '請把下列 Azure 服務拖到對應的正確描述。',
        'stem_en': 'Match the Azure service to the correct description.',
        'pairs': [
            ('Azure DevOps', 'Azure DevOps',
             'An integrated code deployment solution', '整合的程式碼部署解決方案',
             'Azure DevOps 提供版本控制、CI/CD 管線、看板等一整套從開發到部署的工具鏈。'),
            ('Azure Advisor', 'Azure 顧問 (Azure Advisor)',
             'A tool that provides guidance and recommendations to improve your Azure environment',
             '提供指導與建議、協助改善 Azure 環境的工具',
             'Azure 顧問會分析你的資源使用狀況，針對成本、效能、可靠性、安全性提出個人化建議。'),
            ('Azure Cognitive Services', 'Azure 認知服務 (Azure Cognitive Services)',
             'A simplified tool for building intelligent artificial intelligence (AI) applications',
             '用來建置智慧型 AI 應用程式的簡化工具',
             '認知服務提供現成的視覺、語音、語言等 AI 模型 API，開發者不需要自己訓練模型就能加入 AI 功能。'),
            ('Azure Application Insights', 'Azure 應用程式深入解析 (Application Insights)',
             'Monitors web applications', '監視 Web 應用程式',
             'Application Insights 是 Azure 監視器的一項功能，專門用來監視即時 Web 應用程式的效能與例外狀況。'),
        ],
    },
    224: {
        'stem_zh': '請把下列描述拖到對應的正確 Azure 服務。',
        'stem_en': 'Match the description to the correct Azure service.',
        'pairs': [
            ('Azure Sentinel', 'Azure Sentinel',
             'Analyze security log files from Azure virtual machines',
             '分析來自 Azure 虛擬機器的安全性記錄檔',
             'Azure Sentinel 是雲端原生的 SIEM／SOAR 服務，負責收集、關聯、分析大量安全記錄以偵測威脅。'),
            ('Azure Security Center', 'Azure 安全中心 (Azure Security Center)',
             'Display the secure score for an Azure subscription',
             '顯示 Azure 訂用帳戶的安全分數',
             '安全中心（現稱 Microsoft Defender for Cloud）會依據目前的組態算出一個安全分數，並提供改善建議。'),
            ('Azure Key Vault', 'Azure Key Vault',
             'Store passwords for use by Azure Function applications',
             '儲存供 Azure Function 應用程式使用的密碼',
             'Key Vault 專門用來集中儲存與管理密碼、金鑰、憑證等機密資訊，應用程式在執行期間安全地取用。'),
        ],
    },
    427: {
        'stem_zh': '請把下列安全性元件拖到對應的縱深防禦層。',
        'stem_en': 'Match the security component to the correct defense-in-depth layer.',
        'pairs': [
            ('Software updates and patches', '軟體更新與修補程式', 'Compute', '計算層 (Compute)',
             '計算層的防禦重點是讓作業系統與應用程式保持在最新、已修補的狀態，減少已知漏洞被利用的機會。'),
            ('Multifactor authentication (MFA)', '多重要素驗證 (MFA)', 'Identity and access', '身分與存取層',
             '身分與存取層負責確認「誰」在存取資源，MFA 是強化這一層驗證強度最直接的做法。'),
            ('Surveillance camera', '監視攝影機', 'Physical security', '實體安全層',
             '實體安全層防範的是實際進入資料中心的威脅，監視攝影機屬於這一層的控制措施。'),
        ],
    },
    461: {
        'stem_zh': '請把下列描述拖到對應的正確 Azure 服務。',
        'stem_en': 'Match the description to the correct Azure service.',
        'pairs': [
            ('ExpressRoute', 'ExpressRoute',
             'A dedicated private connection that does not traverse the internet',
             '不經過網際網路的專用私人連線',
             'ExpressRoute 透過連線提供者建立實體專線，完全不經過公用網際網路，延遲與頻寬都比一般 VPN 穩定。'),
            ('Virtual Private Network (VPN)', '虛擬私人網路 (VPN)',
             'Uses gateways to encrypt traffic between on-premises and Azure',
             '透過閘道對內部部署與 Azure 之間的流量進行加密',
             'VPN 閘道在內部部署網路與 Azure 虛擬網路之間建立加密通道，流量仍經過網際網路傳輸。'),
            ('Azure Virtual Desktop', 'Azure Virtual Desktop',
             'Provides a full desktop and app virtualization environment that runs in Azure',
             '提供在 Azure 中執行的完整桌面與應用程式虛擬化環境',
             'Azure Virtual Desktop 讓使用者透過任何裝置存取雲端上的完整 Windows 桌面與應用程式，運算全部在 Azure 端進行。'),
        ],
    },
}

# ── ordering：{qid: {'stem_zh','stem_en','steps':[(en, zh), ...]（正確順序）,'explanation_zh'}} ──
ORDERING = {
    162: {
        'stem_zh': '請把下列儲存體帳戶備援選項，依備援程度由低到高排序。',
        'stem_en': 'Arrange the storage account redundancy options from the least redundant to the most redundant.',
        'steps': [
            ('Locally-redundant storage (LRS)', '本機備援儲存體 (LRS)'),
            ('Zone-redundant storage (ZRS)', '區域備援儲存體 (ZRS)'),
            ('Geo-redundant storage (GRS)', '異地備援儲存體 (GRS)'),
        ],
        'step_explanations': [
            '本機備援儲存體 (LRS)。只在同一個資料中心內同步保留三份複本，是備援程度最低的選項——資料中心本身若發生災難，資料就會一起遺失。',
            '區域備援儲存體 (ZRS)。把複本分散到同一區域內的多個可用性區域（不同的實體資料中心），能撐過單一資料中心故障，備援程度比 LRS 高一級。',
            '異地備援儲存體 (GRS)。除了在主要區域維持備援，還把資料非同步複寫到數百英里外的另一個區域，連整個主要區域發生災難都撐得住，是三者中備援程度最高的。',
        ],
        'explanation_zh': 'LRS 只在同一個資料中心內保留三份複本，備援程度最低；ZRS 把複本分散到同一區域內的多個可用性區域，'
                          '能撐過單一資料中心故障；GRS 再把資料非同步複寫到數百英里外的另一個區域，備援程度最高，'
                          '連整個主要區域發生災難都撐得住。',
    },
    390: {
        'stem_zh': '依客戶承擔責任由多到少，排列下列雲端服務模型。',
        'stem_en': 'List each cloud service model in order from most customer responsibility to least customer responsibility.',
        'steps': [
            ('Infrastructure as a Service (IaaS)', '基礎設施即服務 (IaaS)'),
            ('Platform as a Service (PaaS)', '平台即服務 (PaaS)'),
            ('Software as a Service (SaaS)', '軟體即服務 (SaaS)'),
        ],
        'step_explanations': [
            '基礎設施即服務 (IaaS)。供應商只負責實體硬體與虛擬化層，作業系統、執行階段、應用程式與資料全部由客戶自己管理，是客戶責任最重的模型。',
            '平台即服務 (PaaS)。供應商連作業系統與執行階段都代管了，客戶只需要專注在應用程式與資料，責任介於 IaaS 與 SaaS 之間。',
            '軟體即服務 (SaaS)。供應商連應用程式本身都代管了，客戶剩下的責任只有自己的資料，以及身分與存取的管理，是客戶責任最輕的模型。',
        ],
        'explanation_zh': '這是共同責任模型的核心：越往 IaaS 走，客戶要自己管的東西越多（作業系統、執行階段、應用程式全部自理）；'
                          '越往 SaaS 走，客戶要管的東西越少（供應商連應用程式本身都代管了，客戶只剩資料與存取管理）。'
                          '所以由多到少的順序是 IaaS → PaaS → SaaS。',
    },
    467: {
        'stem_zh': '請把下列 Azure 資源，依層級由最上層的父物件排到最下層的子物件。',
        'stem_en': 'Arrange the Azure resources from the highest parent object (top) to the lowest child object.',
        'steps': [
            ('Management Group', '管理群組'),
            ('Azure Subscription', 'Azure 訂用帳戶'),
            ('Resource Group', '資源群組'),
            ('Azure Virtual Machine', 'Azure 虛擬機器'),
        ],
        'step_explanations': [
            '管理群組。位於層級最頂端，可以一次跨多個訂用帳戶套用原則與治理設定，是最大的組織單位。',
            'Azure 訂用帳戶。隸屬於管理群組之下，是計費與存取權的邊界，一個訂用帳戶裡可以有多個資源群組。',
            '資源群組。隸屬於訂用帳戶之下，是用來組織與管理資源的邏輯容器，每個資源都必須屬於某一個資源群組。',
            'Azure 虛擬機器。位於層級最底層，是實際被建立、計費的個別資源，隸屬於某個資源群組之下。',
        ],
        'explanation_zh': 'Azure 資源層級由上到下是：管理群組（可以跨訂用帳戶套用原則與治理）→ 訂用帳戶（計費與存取權的邊界）'
                          '→ 資源群組（訂用帳戶內的邏輯容器）→ 個別資源（例如虛擬機器，是層級中最底層、實際被建立與計費的物件）。',
    },
}

# ── multiple：{qid: {'stem_zh','stem_en','options':[(en, zh, bool_selected, explain_zh), ...]}} ──
MULTIPLE = {
    1: {
        'stem_zh': '貴公司打算訂閱一個 Azure 支援方案，該方案必須允許開啟新的支援請求。下列哪些是符合此條件的支援方案？（請選出所有適用項目）',
        'stem_en': 'Your company intends to subscribe to an Azure support plan. The support plan must allow for new support requests to be opened. '
                   'Which of the following are support plans that will allow this?',
        'options': [
            ('Basic', 'Basic', False, 'Basic 是每個 Azure 訂用帳戶內建的免費層級，只能查閱文件與社群支援，不能開立支援請求。'),
            ('Developer', 'Developer', True, 'Developer 方案面向非正式環境的開發測試，雖然是最低階的付費方案，但已經可以開立支援請求。'),
            ('Standard', 'Standard', True, 'Standard 方案面向正式環境的工作負載，提供更快的回應時間，同樣可以開立支援請求。'),
            ('PROFESSIONAL DIRECT', 'Professional Direct', True, 'Professional Direct 除了可以開立支援請求，還加上架構指引與檢閱等進階服務。'),
            ('PREMIER', 'Premier', True, 'Premier（現多由 Unified Support 取代）是最高階的支援方案，同樣涵蓋開立支援請求的功能。'),
        ],
    },
    28: {
        'stem_zh': '貴公司想要使用 Azure Government 開發雲端解決方案。Azure Government 只能提供給特定類型的客戶使用。'
                   '在這種情況下，下列哪些客戶類型可以使用 Azure Government？（請選出所有適用項目）',
        'stem_en': 'The company would like to develop a cloud solution by making use of Azure Government. Azure Government can only be used by '
                   'certain types of clients to develop cloud solutions. Which of the following are the types of customers that can make use '
                   'of Azure Government in this situation?',
        'options': [
            ('A government contractor from any country', '任何國家的政府承包商', False,
             'Azure Government 僅限美國政府機構及其承包商使用，其他國家的政府承包商不符合資格。'),
            ('A government entity from any country', '任何國家的政府實體', False,
             '同理，非美國的政府實體同樣不符合 Azure Government 的使用資格。'),
            ('A European government contractor', '歐洲政府承包商', False,
             '歐洲政府承包商不在 Azure Government 的服務對象範圍內。'),
            ('A European government entity', '歐洲政府實體', False,
             '歐洲政府實體同樣不符合資格。'),
            ('A United States government contractor', '美國政府承包商', True,
             'Azure Government 是專為美國聯邦、州、地方政府與其承包商打造的獨立雲端環境，符合更嚴格的合規要求。'),
            ('A United States government entity', '美國政府實體', True,
             '美國政府實體正是 Azure Government 設計服務的核心對象。'),
        ],
    },
}
