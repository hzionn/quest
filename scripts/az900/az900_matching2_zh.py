#!/usr/bin/env python3
"""HOTSPOT「多欄下拉」批次的配對子集（8 題）＋ 剩餘 DRAG DROP（19 題）。

兩批來源格式不同（前者是入口網站下拉選單、後者是拖曳配對／排序），
但轉成題庫格式後都是同一種形狀，合併在一起維護：
  ・MATCHING2（26 題）：配對題，直接組給 build_matching_generic()。
  ・ORDERING2（1 題，id 227 縱深防禦）：排序題，組給 build_ordering()。

半數以上題目來源的 sections[2]／[3] 只給了「正解」，沒給完整的候選項目池
與其他描述——這種情況一律用 render_az900.py 截圖答案區，核對圖上的正確
配對後再手動寫入（id 133/140/227/234/287/348/386/387/395/469/472）。
"""

MATCHING2 = {
    46: {
        'stem_zh': '哪種雲端部署解決方案分別用於 Azure 虛擬機器和 Azure SQL 資料庫？',
        'stem_en': 'Which cloud deployment solution is used for Azure virtual machines and Azure SQL databases?',
        'pool_zh': ['基礎設施即服務 (IaaS)', '平台即服務 (PaaS)', '軟體即服務 (SaaS)'],
        'pool_en': ['Infrastructure as a service (IaaS)', 'Platform as a service (PaaS)', 'Software as a service (SaaS)'],
        'matches': [
            {
                'use_case_zh': 'Azure 虛擬機器', 'use_case_en': 'Azure Virtual Machines',
                'answer_zh': '基礎設施即服務 (IaaS)', 'answer_en': 'Infrastructure as a service (IaaS)',
                'explain_zh': 'Azure 虛擬機器讓你完全掌控作業系統、網路設定與儲存資源，你需要自行安裝、修補與維護作業系統及應用程式，屬於基礎設施即服務 (IaaS) 的典型範例。',
            },
            {
                'use_case_zh': 'Azure SQL 資料庫', 'use_case_en': 'Azure SQL Databases',
                'answer_zh': '平台即服務 (PaaS)', 'answer_en': 'Platform as a service (PaaS)',
                'explain_zh': 'Azure SQL 資料庫是受控的資料庫服務，微軟負責底層基礎設施、修補與備份等維運工作，你只需專注於資料與應用程式邏輯，屬於平台即服務 (PaaS)。',
            },
        ],
    },
    61: {
        'stem_zh': '將雲端模型與其正確的優勢配對。',
        'stem_en': 'Match the cloud model to the correct advantage.',
        'pool_zh': ['混合雲', '私有雲', '公用雲'],
        'pool_en': ['Hybrid Cloud', 'Private Cloud', 'Public Cloud'],
        'matches': [
            {
                'use_case_zh': '提供在地端與雲端資源之間自由選擇的彈性', 'use_case_en': 'Provides a choice to use on-premises or cloud-based resources',
                'answer_zh': '混合雲', 'answer_en': 'Hybrid Cloud',
                'explain_zh': '混合雲結合公用雲與私有（地端）環境，企業可以依工作負載的需求自行決定要留在地端或搬上雲端，這種自由選擇正是混合雲的核心優勢。',
            },
            {
                'use_case_zh': '可完全掌控安全性', 'use_case_en': 'Provides complete control over security',
                'answer_zh': '私有雲', 'answer_en': 'Private Cloud',
                'explain_zh': '私有雲是專屬單一組織的雲端環境，基礎設施完全由該組織（或其委託對象）管理，因此組織可以對安全性設定擁有完整的控制權。',
            },
            {
                'use_case_zh': '不需要資本支出', 'use_case_en': 'No required capital expenditure',
                'answer_zh': '公用雲', 'answer_en': 'Public Cloud',
                'explain_zh': '公用雲由服務供應商擁有並維運實體基礎設施，用戶只需依使用量付費（營運支出），不必自行採購硬體，因此不需要資本支出。',
            },
        ],
    },
    82: {
        'stem_zh': '你計劃使用 Azure 代管兩個應用程式，分別命名為 App1 和 App2。這些應用程式必須符合以下需求：\n- 你必須能夠修改 App1 的程式碼。\n- 必須盡量減少管理 App1 作業系統所需的行政工作。\n- App2 必須能與伺服器的作業系統直接互動執行。\n你應該為每個應用程式使用哪種類型的雲端服務？',
        'stem_en': 'You plan to use Azure to host two apps named App1 and App2. The apps must meet the following requirements:\n- You must be able to modify the code of App1.\n- Administrative effort to manage the operating system of App1 must be minimized.\n- App2 must run interactively with the operating system of the server.\nWhich type of cloud service should you use for each app?',
        'pool_zh': ['基礎設施即服務 (IaaS)', '平台即服務 (PaaS)', '軟體即服務 (SaaS)'],
        'pool_en': ['Infrastructure as a service (IaaS)', 'Platform as a service (PaaS)', 'Software as a service (SaaS)'],
        'matches': [
            {
                'use_case_zh': 'App1', 'use_case_en': 'App1',
                'answer_zh': '平台即服務 (PaaS)', 'answer_en': 'Platform as a service (PaaS)',
                'explain_zh': '由於你需要能修改 App1 的程式碼，同時盡量減少管理作業系統的行政負擔，PaaS 讓你專注於程式碼與應用程式部署，底層作業系統與基礎設施則由平台代管，因此最符合需求。',
            },
            {
                'use_case_zh': 'App2', 'use_case_en': 'App2',
                'answer_zh': '基礎設施即服務 (IaaS)', 'answer_en': 'Infrastructure as a service (IaaS)',
                'explain_zh': 'App2 需要直接與伺服器的作業系統互動，代表你需要完全掌控虛擬機器，因此應採用 IaaS，讓你能自行管理並存取底層作業系統。',
            },
        ],
    },
    116: {
        'stem_zh': '你計劃將一個關鍵的業務用途應用程式部署到 Azure，該應用程式將執行在一台 Azure 虛擬機器上。你需要為此應用程式建議一套部署解決方案，該方案必須提供 99.99% 的可用性保證。你應該建議的最少虛擬機器數量與最少可用性區域數量各是多少？',
        'stem_en': 'You plan to deploy a critical line-of-business application to Azure. The application will run on an Azure virtual machine. You need to recommend a deployment solution for the application. The solution must provide a guaranteed availability of 99.99 percent. What is the minimum number of virtual machines and the minimum number of availability zones you should recommend for the deployment?',
        'pool_zh': ['1', '2', '3'],
        'pool_en': ['1', '2', '3'],
        'matches': [
            {
                'use_case_zh': '最少需要的虛擬機器數量', 'use_case_en': 'Minimum number of virtual machines',
                'answer_zh': '2', 'answer_en': '2',
                'explain_zh': '要達到 99.99% 的可用性保證，至少需要部署 2 台虛擬機器以形成備援，若其中一台發生故障，另一台仍可繼續提供服務。',
            },
            {
                'use_case_zh': '最少需要的可用性區域數量', 'use_case_en': 'Minimum number of availability zones',
                'answer_zh': '2', 'answer_en': '2',
                'explain_zh': '這些虛擬機器必須分別部署在至少 2 個不同的可用性區域中，透過區域層級的實體隔離與備援，才能達到 Azure 所提供的 99.99% VM 正常執行時間 SLA。',
            },
        ],
    },
    133: {
        'stem_zh': '將 Azure 服務與其適當的描述配對。',
        'stem_en': 'Match the Azure service to the appropriate description.',
        'pool_zh': ['Azure Cosmos DB', 'Azure HDInsight', 'Azure Synapse Analytics'],
        'pool_en': ['Azure Cosmos DB', 'Azure HDInsight', 'Azure Synapse Analytics'],
        'matches': [
            {
                'use_case_zh': '全受控的資料倉儲，在任何規模層級都內建安全性，且不額外收費。', 'use_case_en': 'A fully managed data warehouse that has integral security at every level of scale at no extra cost.',
                'answer_zh': 'Azure Synapse Analytics', 'answer_en': 'Azure Synapse Analytics',
                'explain_zh': 'Synapse Analytics 是企業級的全受控資料倉儲服務，安全性機制內建於服務本身，不論資料規模擴展到多大都不需要額外付費啟用。',
            },
            {
                'use_case_zh': '支援 NoSQL 的全球分散式資料庫。', 'use_case_en': 'A globally distributed database that supports NoSQL.',
                'answer_zh': 'Azure Cosmos DB', 'answer_en': 'Azure Cosmos DB',
                'explain_zh': 'Cosmos DB 是全球分散式、多模型的資料庫服務，原生支援 NoSQL 資料模型，可以將資料複寫到多個地區以達到低延遲與高可用性。',
            },
            {
                'use_case_zh': '雲端受控的 Apache Hadoop 叢集，可用來處理巨量資料。', 'use_case_en': 'Managed Apache Hadoop clusters in the cloud that enable you to process massive amounts of data.',
                'answer_zh': 'Azure HDInsight', 'answer_en': 'Azure HDInsight',
                'explain_zh': 'HDInsight 是受控的開放原始碼分析服務，提供 Hadoop、Spark 等叢集，用來處理與分析巨量資料，不需要自行架設與維護叢集。',
            },
        ],
    },
    140: {
        'stem_zh': '將 Azure 服務與其正確的描述配對。',
        'stem_en': 'Match the Azure services to the correct descriptions.',
        'pool_zh': ['Azure 虛擬機器', 'Azure Container Instances', 'Azure App Service', 'Azure Functions'],
        'pool_en': ['Azure virtual machines', 'Azure Container Instances', 'Azure App Service', 'Azure Functions'],
        'matches': [
            {
                'use_case_zh': '提供作業系統虛擬化。', 'use_case_en': 'Provide operating system virtualization.',
                'answer_zh': 'Azure 虛擬機器', 'answer_en': 'Azure virtual machines',
                'explain_zh': '虛擬機器是隨選、可擴充的運算資源之一，當你需要比其他選項更完整地控制運算環境（包括作業系統本身）時，就會選擇虛擬機器。',
            },
            {
                'use_case_zh': '為虛擬化的應用程式提供可攜式的執行環境。', 'use_case_en': 'Provide portable environment for virtualized applications.',
                'answer_zh': 'Azure Container Instances', 'answer_en': 'Azure Container Instances',
                'explain_zh': '容器是目前封裝、部署與管理雲端應用程式的主流方式，Container Instances 讓你不需要佈建或管理任何虛擬機器，就能在幾秒鐘內啟動容器，提供輕量可攜的執行環境。',
            },
            {
                'use_case_zh': '用於建置、部署與擴展 Web 應用程式。', 'use_case_en': 'Used to build, deploy, and scale web apps.',
                'answer_zh': 'Azure App Service', 'answer_en': 'Azure App Service',
                'explain_zh': 'App Service 是 PaaS 服務，讓你可以為任何平台或裝置建立 Web 與行動應用程式，同時處理應用程式的建置、部署與擴展。',
            },
            {
                'use_case_zh': '提供無伺服器程式碼的執行平台。', 'use_case_en': 'Provide a platform for serverless code.',
                'answer_zh': 'Azure Functions', 'answer_en': 'Azure Functions',
                'explain_zh': 'Azure Functions 是無伺服器運算服務，讓你執行事件觸發的程式碼，而不需要明確佈建或管理任何基礎設施。',
            },
        ],
    },
    150: {
        'stem_zh': '將雲端服務模型與其適當的解決方案配對。',
        'stem_en': 'Match the cloud service models to the appropriate solutions.',
        'pool_zh': ['基礎設施即服務 (IaaS)', '軟體即服務 (SaaS)', '平台即服務 (PaaS)'],
        'pool_en': ['Infrastructure-as-a-Service (IaaS)', 'Software-as-a-Service (SaaS)', 'Platform-as-a-Service (PaaS)'],
        'matches': [
            {
                'use_case_zh': '雲端檔案伺服器', 'use_case_en': 'A cloud-based file server',
                'answer_zh': '基礎設施即服務 (IaaS)', 'answer_en': 'Infrastructure-as-a-Service (IaaS)',
                'explain_zh': '檔案伺服器需要使用者自行安裝與管理作業系統及檔案共用軟體，這種需要完整控制底層基礎設施的情境屬於 IaaS。',
            },
            {
                'use_case_zh': '雲端會計系統', 'use_case_en': 'A cloud-based accounting system',
                'answer_zh': '軟體即服務 (SaaS)', 'answer_en': 'Software-as-a-Service (SaaS)',
                'explain_zh': '會計系統是使用者直接使用的現成應用程式，不需要管理底層基礎設施或開發平台，這正是 SaaS 的典型情境。',
            },
            {
                'use_case_zh': '用於自訂應用程式的雲端服務', 'use_case_en': 'A cloud-based service for custom apps',
                'answer_zh': '平台即服務 (PaaS)', 'answer_en': 'Platform-as-a-Service (PaaS)',
                'explain_zh': 'PaaS 提供開發與部署自訂應用程式所需的平台與工具，使用者只需專注於程式開發，不必管理底層作業系統，適合建置自訂應用程式的情境。',
            },
        ],
    },
    170: {
        'stem_zh': '將 Azure 服務與其正確的描述配對。',
        'stem_en': 'Match the Azure service to the correct description.',
        'pool_zh': ['Azure SQL Database', 'Azure Synapse Analytics', 'Azure Data Lake Analytics', 'Azure HDInsight'],
        'pool_en': ['Azure SQL Database', 'Azure Synapse Analytics', 'Azure Data Lake Analytics', 'Azure HDInsight'],
        'matches': [
            {
                'use_case_zh': '受控的雲端關聯式資料庫服務', 'use_case_en': 'A managed relational cloud database service',
                'answer_zh': 'Azure SQL Database', 'answer_en': 'Azure SQL Database',
                'explain_zh': 'Azure SQL Database 是完全受控的關聯式資料庫服務，Microsoft 負責修補、備份與高可用性等維運工作，讓使用者專注於資料庫設計本身。',
            },
            {
                'use_case_zh': '運用大規模平行處理 (MPP) 技術，在關聯式資料庫中對 PB 等級資料快速執行複雜查詢的雲端服務', 'use_case_en': 'A cloud-based service that leverages massively parallel processing (MPP) to quickly run complex queries across petabytes of data in a relational database',
                'answer_zh': 'Azure Synapse Analytics', 'answer_en': 'Azure Synapse Analytics',
                'explain_zh': 'Synapse Analytics 底層採用大規模平行處理架構，能夠將查詢工作分散到多個運算節點同時執行，因此可以在 PB 等級的關聯式資料中快速完成複雜查詢，是企業級資料倉儲的核心能力。',
            },
            {
                'use_case_zh': '可對 PB 等級資料執行大規模平行的資料轉換與處理程式', 'use_case_en': 'Can run massively parallel data transformation and processing programs across petabytes of data',
                'answer_zh': 'Azure Data Lake Analytics', 'answer_en': 'Azure Data Lake Analytics',
                'explain_zh': 'Data Lake Analytics 是隨選的巨量資料分析工作服務，可以撰寫並執行大規模平行處理的轉換與分析程式，不需要自行管理叢集，用多少算多少。',
            },
            {
                'use_case_zh': '用於在叢集中分散式處理與分析巨量資料集的開放原始碼架構', 'use_case_en': 'An open-source framework for the distributed processing and analysis of big data sets in clusters',
                'answer_zh': 'Azure HDInsight', 'answer_en': 'Azure HDInsight',
                'explain_zh': 'HDInsight 是受控的開放原始碼分析服務，讓使用者可以在雲端執行 Hadoop、Spark 等開放原始碼巨量資料架構，以叢集方式分散處理大規模資料集。',
            },
        ],
    },
    171: {
        'stem_zh': '你需要確定在 Azure 入口網站中，必須使用哪些 blade 來執行以下工作：\n- 檢視安全性建議。\n- 監視 Azure 服務的健康狀態。\n- 瀏覽可用的虛擬機器映像。\n你應該為每項工作識別哪個 blade？',
        'stem_en': 'You need to identify which blades in the Azure portal must be used to perform the following tasks:\n- View security recommendations.\n- Monitor the health of Azure services.\n- Browse available virtual machine images.\nWhich blade should you identify for each task?',
        'pool_zh': ['監視器 (Monitor)', '訂用帳戶 (Subscriptions)', '市集 (Marketplace)', 'advisor (顧問)'],
        'pool_en': ['Monitor', 'Subscriptions', 'Marketplace', 'Advisor'],
        'matches': [
            {
                'use_case_zh': '監視 Azure 服務的健康狀態', 'use_case_en': 'Monitor the health of Azure services',
                'answer_zh': '監視器 (Monitor)', 'answer_en': 'Monitor',
                'explain_zh': '監視器 (Monitor) 是 Azure 入口網站中用來收集、分析 Azure 資源效能指標與診斷記錄的主要工具，可用來監視 Azure 服務的健康狀態。',
            },
            {
                'use_case_zh': '瀏覽可用的虛擬機器映像', 'use_case_en': 'Browse available virtual machine images',
                'answer_zh': '市集 (Marketplace)', 'answer_en': 'Marketplace',
                'explain_zh': '市集 (Marketplace) 提供各種預先設定好的虛擬機器映像與解決方案，讓你瀏覽並選擇要部署的映像。',
            },
            {
                'use_case_zh': '檢視安全性建議', 'use_case_en': 'View security recommendations',
                'answer_zh': 'advisor (顧問)', 'answer_en': 'Advisor',
                'explain_zh': 'advisor (顧問) 會分析你的資源設定，提供安全性、成本、效能與可靠性等方面的最佳化建議，是檢視安全性建議的正確工具。',
            },
        ],
    },
    180: {
        'stem_zh': '將 Azure 服務與其正確的描述配對。',
        'stem_en': 'Match the Azure services to the correct descriptions.',
        'pool_zh': ['Azure Synapse Analytics', 'Azure Machine Learning', 'Azure Functions', 'Azure IoT Hub'],
        'pool_en': ['Azure Synapse Analytics', 'Azure Machine Learning', 'Azure Functions', 'Azure IoT Hub'],
        'matches': [
            {
                'use_case_zh': '提供雲端企業資料倉儲 (EDW)', 'use_case_en': 'Provides a cloud-based Enterprise Data Warehouse (EDW)',
                'answer_zh': 'Azure Synapse Analytics', 'answer_en': 'Azure Synapse Analytics',
                'explain_zh': 'Synapse Analytics 整合了大數據與資料倉儲功能，可作為企業級的雲端資料倉儲，集中存放並分析組織的結構化資料。',
            },
            {
                'use_case_zh': '運用過去的訓練結果，提供高機率準確的預測', 'use_case_en': 'Uses past trainings to provide predictions that have high probability',
                'answer_zh': 'Azure Machine Learning', 'answer_en': 'Azure Machine Learning',
                'explain_zh': '機器學習服務讓開發者建立、訓練並部署模型，模型透過歷史資料學習規律後，可以對新資料做出高機率準確的預測。',
            },
            {
                'use_case_zh': '提供無伺服器運算功能', 'use_case_en': 'Provides serverless computing functionalities',
                'answer_zh': 'Azure Functions', 'answer_en': 'Azure Functions',
                'explain_zh': 'Azure Functions 是無伺服器運算服務，開發者只需撰寫事件觸發的程式碼片段，不需要佈建或管理任何伺服器基礎設施。',
            },
            {
                'use_case_zh': '處理來自數百萬個感測器的資料', 'use_case_en': 'Processes data from millions of sensors',
                'answer_zh': 'Azure IoT Hub', 'answer_en': 'Azure IoT Hub',
                'explain_zh': 'IoT 中樞是集中式的訊息中樞，專門用來大規模雙向連接、監控與管理數百萬個 IoT 裝置與感測器所傳送的資料。',
            },
        ],
    },
    187: {
        'stem_zh': '幾位支援工程師計劃使用下表所示的電腦來管理 Azure：\n電腦一 (Windows 10)、電腦二 (Ubuntu)、電腦三 (macOS Mojave)。\n你需要確定可以從每台電腦使用哪些 Azure 管理工具。針對每台電腦，你應該識別出什麼？',
        'stem_en': 'Several support engineers plan to manage Azure by using the computers shown in the following table:\nComputer1 (Windows 10), Computer2 (Ubuntu), Computer3 (macOS Mojave).\nYou need to identify which Azure management tools can be used from each computer. What should you identify for each computer?',
        'pool_zh': ['Azure CLI 與 Azure 入口網站', 'Azure 入口網站與 Azure PowerShell', 'Azure CLI 與 Azure PowerShell', 'Azure CLI、Azure 入口網站與 Azure PowerShell'],
        'pool_en': ['The Azure CLI and the Azure portal', 'The Azure portal and Azure PowerShell', 'The Azure CLI and Azure PowerShell', 'The Azure CLI, the Azure portal, and Azure PowerShell'],
        'matches': [
            {
                'use_case_zh': '電腦一 (Windows 10)', 'use_case_en': 'Computer1 (Windows 10)',
                'answer_zh': 'Azure CLI、Azure 入口網站與 Azure PowerShell', 'answer_en': 'The Azure CLI, the Azure portal, and Azure PowerShell',
                'explain_zh': 'Windows 10 原生支援 Azure CLI 與 Azure PowerShell，再加上可透過瀏覽器存取的 Azure 入口網站，因此三種管理工具都可以使用。',
            },
            {
                'use_case_zh': '電腦二 (Ubuntu)', 'use_case_en': 'Computer2 (Ubuntu)',
                'answer_zh': 'Azure CLI、Azure 入口網站與 Azure PowerShell', 'answer_en': 'The Azure CLI, the Azure portal, and Azure PowerShell',
                'explain_zh': '隨著 PowerShell 開源並支援跨平台，Ubuntu 上也能安裝並使用 Azure CLI 與 Azure PowerShell，加上可透過瀏覽器存取的入口網站，因此三種工具皆可使用。',
            },
            {
                'use_case_zh': '電腦三 (macOS Mojave)', 'use_case_en': 'Computer3 (macOS Mojave)',
                'answer_zh': 'Azure CLI、Azure 入口網站與 Azure PowerShell', 'answer_en': 'The Azure CLI, the Azure portal, and Azure PowerShell',
                'explain_zh': 'macOS 同樣可安裝 Azure CLI 與跨平台的 Azure PowerShell，並透過瀏覽器使用 Azure 入口網站，因此三種管理工具在 macOS 上都能使用。',
            },
        ],
    },
    190: {
        'stem_zh': '將 Azure 服務與其正確的描述配對。',
        'stem_en': 'Match the Azure service to the correct description.',
        'pool_zh': ['Azure Bot Services', 'Azure Machine Learning', 'Azure Functions', 'Azure IoT Hub'],
        'pool_en': ['Azure Bot Services', 'Azure Machine Learning', 'Azure Functions', 'Azure IoT Hub'],
        'matches': [
            {
                'use_case_zh': '提供具備語音支援功能的數位線上助理', 'use_case_en': 'Provides a digital online assistant that provides speech support',
                'answer_zh': 'Azure Bot Services', 'answer_en': 'Azure Bot Services',
                'explain_zh': 'Azure Bot Services 用來建置、測試並部署智慧聊天機器人，支援與語音相關的認知服務整合，讓機器人可以用語音與使用者互動。',
            },
            {
                'use_case_zh': '運用過去的訓練結果，提供高機率準確的預測', 'use_case_en': 'Uses past trainings to provide predictions that have high probability',
                'answer_zh': 'Azure Machine Learning', 'answer_en': 'Azure Machine Learning',
                'explain_zh': '機器學習服務讓開發者建立、訓練並部署模型，模型透過歷史資料學習規律後，可以對新資料做出高機率準確的預測。',
            },
            {
                'use_case_zh': '提供無伺服器運算功能', 'use_case_en': 'Provides serverless computing functionalities',
                'answer_zh': 'Azure Functions', 'answer_en': 'Azure Functions',
                'explain_zh': 'Azure Functions 是無伺服器運算服務，開發者只需撰寫事件觸發的程式碼片段，不需要佈建或管理任何伺服器基礎設施。',
            },
            {
                'use_case_zh': '處理來自數百萬個感測器的資料', 'use_case_en': 'Processes data from millions of sensors',
                'answer_zh': 'Azure IoT Hub', 'answer_en': 'Azure IoT Hub',
                'explain_zh': 'IoT 中樞是集中式的訊息中樞，專門用來大規模雙向連接、監控與管理數百萬個 IoT 裝置與感測器所傳送的資料。',
            },
        ],
    },
    192: {
        'stem_zh': '將 Azure 服務與其正確的描述配對。',
        'stem_en': 'Match the Azure service to the correct description.',
        'pool_zh': ['Azure 虛擬機器', 'Azure Container Instances', 'Azure App Service', 'Azure Functions'],
        'pool_en': ['Azure virtual machines', 'Azure Container Instances', 'Azure App Service', 'Azure Functions'],
        'matches': [
            {
                'use_case_zh': '提供作業系統虛擬化。', 'use_case_en': 'Provide operating system virtualization.',
                'answer_zh': 'Azure 虛擬機器', 'answer_en': 'Azure virtual machines',
                'explain_zh': '虛擬機器是隨選、可擴充的運算資源之一，當你需要比其他選項更完整地控制運算環境（包括作業系統本身）時，就會選擇虛擬機器。',
            },
            {
                'use_case_zh': '為虛擬化的應用程式提供可攜式的執行環境。', 'use_case_en': 'Provide portable environment for virtualized applications.',
                'answer_zh': 'Azure Container Instances', 'answer_en': 'Azure Container Instances',
                'explain_zh': '容器是目前封裝、部署與管理雲端應用程式的主流方式，Container Instances 讓你不需要佈建或管理任何虛擬機器，就能在幾秒鐘內啟動容器，提供輕量可攜的執行環境。',
            },
            {
                'use_case_zh': '用於建置、部署與擴展 Web 應用程式。', 'use_case_en': 'Used to build, deploy, and scale web apps.',
                'answer_zh': 'Azure App Service', 'answer_en': 'Azure App Service',
                'explain_zh': 'App Service 是 PaaS 服務，讓你可以為任何平台或裝置建立 Web 與行動應用程式，並輕鬆連接雲端或地端的資料來源，同時處理應用程式的建置、部署與擴展。',
            },
            {
                'use_case_zh': '提供無伺服器程式碼的執行平台。', 'use_case_en': 'Provide a platform for serverless code.',
                'answer_zh': 'Azure Functions', 'answer_en': 'Azure Functions',
                'explain_zh': 'Azure Functions 是無伺服器運算服務，讓你執行事件觸發的程式碼，而不需要明確佈建或管理任何基礎設施。',
            },
        ],
    },
    202: {
        'stem_zh': '將 Azure 服務與其正確的定義配對。',
        'stem_en': 'Match the Azure service to the correct definition.',
        'pool_zh': ['Azure Functions', 'Azure Databricks', 'Azure Application Insights', 'Azure App Service'],
        'pool_en': ['Azure Functions', 'Azure Databricks', 'Azure Application Insights', 'Azure App Service'],
        'matches': [
            {
                'use_case_zh': '提供無伺服器程式碼的執行平台', 'use_case_en': 'Provides the platform for serverless code',
                'answer_zh': 'Azure Functions', 'answer_en': 'Azure Functions',
                'explain_zh': 'Azure Functions 讓開發者可以執行小型的事件驅動程式碼片段，不需要自行管理底層基礎設施，是典型的無伺服器運算服務。',
            },
            {
                'use_case_zh': '用於機器學習的巨量資料分析服務', 'use_case_en': 'A big data analysis service for machine learning',
                'answer_zh': 'Azure Databricks', 'answer_en': 'Azure Databricks',
                'explain_zh': 'Azure Databricks 是以 Apache Spark 為基礎的分析平台，專為資料工程與機器學習工作負載最佳化，讓資料科學家能夠協作分析巨量資料。',
            },
            {
                'use_case_zh': '偵測並診斷 Web 應用程式的異常狀況', 'use_case_en': 'Detects and diagnoses anomalies in web apps',
                'answer_zh': 'Azure Application Insights', 'answer_en': 'Azure Application Insights',
                'explain_zh': 'Application Insights 是應用程式效能管理服務，能自動偵測效能異常、例外狀況與使用模式，協助開發者診斷並排除 Web 應用程式的問題。',
            },
            {
                'use_case_zh': '裝載 Web 應用程式', 'use_case_en': 'Hosts web apps',
                'answer_zh': 'Azure App Service', 'answer_en': 'Azure App Service',
                'explain_zh': 'App Service 是完全受控的 PaaS 平台，用來裝載、部署與擴展 Web 應用程式，開發者不需要自行管理底層伺服器。',
            },
        ],
    },
    234: {
        'stem_zh': '將 Azure 服務的優勢與其正確的描述配對。',
        'stem_en': 'Match the Azure services benefits to the correct descriptions.',
        'pool_zh': ['Azure Active Directory (Azure AD)', 'Azure Key Vault', 'Azure Lighthouse', 'Microsoft Defender for Cloud', 'Microsoft Sentinel'],
        'pool_en': ['Azure Active Directory (Azure AD)', 'Azure Key Vault', 'Azure Lighthouse', 'Microsoft Defender for Cloud', 'Microsoft Sentinel'],
        'matches': [
            {
                'use_case_zh': '提供安全性資訊與事件管理 (SIEM) 功能', 'use_case_en': 'Provide security information event management (SIEM) functionality',
                'answer_zh': 'Microsoft Sentinel', 'answer_en': 'Microsoft Sentinel',
                'explain_zh': 'Microsoft Sentinel 是雲原生的 SIEM 與 SOAR 服務，專門用來蒐集、分析並回應整個環境中的安全事件，正是 SIEM 功能的提供者。',
            },
            {
                'use_case_zh': '顯示 Azure 訂用帳戶的安全分數', 'use_case_en': 'Display the secure score for an Azure subscription',
                'answer_zh': 'Microsoft Defender for Cloud', 'answer_en': 'Microsoft Defender for Cloud',
                'explain_zh': 'Defender for Cloud 會針對訂用帳戶的資源組態持續評估，並匯總成一個安全分數，方便你追蹤整體安全態勢的改善進度。',
            },
            {
                'use_case_zh': '儲存供 Azure Functions 應用程式使用的密碼', 'use_case_en': 'Store passwords for use by Azure Function applications',
                'answer_zh': 'Azure Key Vault', 'answer_en': 'Azure Key Vault',
                'explain_zh': 'Key Vault 是集中式的機密管理服務，用來安全儲存密碼、金鑰與憑證，應用程式（包括 Azure Functions）可以在執行階段安全地取用，不需要把密碼寫死在程式碼中。',
            },
        ],
    },
    249: {
        'stem_zh': '你計劃為 Azure 環境實作多項安全性服務。你需要確定必須使用哪些 Azure 服務，以符合以下安全性需求：\n- 使用感測器監控威脅\n- 根據條件強制執行 Azure 多重要素驗證 (MFA)\n你應該為每項需求識別出哪項 Azure 服務？',
        'stem_en': 'You plan to implement several security services for an Azure environment. You need to identify which Azure services must be used to meet the following security requirements:\n- Monitor threats by using sensors\n- Enforce Azure Multi-Factor Authentication (MFA) based on a condition\nWhich Azure service should you identify for each requirement?',
        'pool_zh': ['Azure Monitor (監視器)', 'Azure 安全性中心 (Security Center)', 'Azure Active Directory (Azure AD) 身分識別保護 (Identity Protection)', 'Azure 進階威脅防護 (Advanced Threat Protection, ATP)'],
        'pool_en': ['Azure Monitor', 'Azure Security Center', 'Azure Active Directory (Azure AD) Identity Protection', 'Azure Advanced Threat Protection (ATP)'],
        'matches': [
            {
                'use_case_zh': '使用感測器監控威脅', 'use_case_en': 'Monitor threats by using sensors',
                'answer_zh': 'Azure 進階威脅防護 (Advanced Threat Protection, ATP)', 'answer_en': 'Azure Advanced Threat Protection (ATP)',
                'explain_zh': 'Azure 進階威脅防護 (ATP) 會在網域控制站部署感測器，分析並偵測針對身分識別的可疑活動與潛在攻擊，正是透過感測器監控威脅的服務。',
            },
            {
                'use_case_zh': '根據條件強制執行 Azure 多重要素驗證 (MFA)', 'use_case_en': 'Enforce Azure MFA based on a condition',
                'answer_zh': 'Azure Active Directory (Azure AD) 身分識別保護 (Identity Protection)', 'answer_en': 'Azure Active Directory (Azure AD) Identity Protection',
                'explain_zh': 'Azure AD 身分識別保護 (Identity Protection) 可根據登入風險等級等條件建立條件式存取原則，動態要求使用者完成多重要素驗證 (MFA)。',
            },
        ],
    },
    272: {
        'stem_zh': '將名詞與其正確的定義配對。',
        'stem_en': 'Match the term to the correct definition.',
        'pool_zh': ['ISO', 'NIST', 'GDPR', 'Azure Government'],
        'pool_en': ['ISO', 'NIST', 'GDPR', 'Azure Government'],
        'matches': [
            {
                'use_case_zh': '為所有產業制定國際標準的組織', 'use_case_en': 'An organization that defines international standards across all industries',
                'answer_zh': 'ISO', 'answer_en': 'ISO',
                'explain_zh': 'ISO（國際標準化組織）制定橫跨各行各業的國際標準，涵蓋品質管理、資訊安全等領域，是全球通用的標準制定機構。',
            },
            {
                'use_case_zh': '制定美國政府採用之標準的組織', 'use_case_en': 'An organization that defines standards used by the United States government',
                'answer_zh': 'NIST', 'answer_en': 'NIST',
                'explain_zh': 'NIST（美國國家標準與技術研究院）隸屬美國商務部，負責制定包括資訊安全在內、供美國聯邦政府機構採用的各項標準與框架。',
            },
            {
                'use_case_zh': '規範資料隱私與資料保護的歐洲法規', 'use_case_en': 'A European policy that regulates data privacy and data protection',
                'answer_zh': 'GDPR', 'answer_en': 'GDPR',
                'explain_zh': 'GDPR（一般資料保護規則）是歐盟於 2018 年 5 月施行的資料保護法規，規範企業如何蒐集、處理與保護歐盟境內個人的資料。',
            },
            {
                'use_case_zh': '專供美國聯邦與州政府機構使用的專屬公用雲', 'use_case_en': 'A dedicated public cloud for federal and state agencies in the United States',
                'answer_zh': 'Azure Government', 'answer_en': 'Azure Government',
                'explain_zh': 'Azure Government 是實體隔離的獨立 Azure 環境，僅開放給美國聯邦、州、地方政府機構及其合作夥伴使用，符合特定政府法規遵循要求。',
            },
        ],
    },
    287: {
        'stem_zh': '將資源與其適當的描述配對。',
        'stem_en': 'Match the resources to the appropriate descriptions.',
        'pool_zh': ['Microsoft 隱私權聲明', '線上服務條款', '資料保護附錄'],
        'pool_en': ['Microsoft Privacy Statement', 'Online Services Terms', 'Data Protection Addendum'],
        'matches': [
            {
                'use_case_zh': '說明會蒐集哪些個人資料、如何使用這些資料，以及資料的使用目的。', 'use_case_en': 'Describes which personal data is collected, how the data is used, and what the data is used for.',
                'answer_zh': 'Microsoft 隱私權聲明', 'answer_en': 'Microsoft Privacy Statement',
                'explain_zh': '這是微軟對外公開說明蒐集哪些個人資料、如何使用及其目的的聲明文件，對應題目所描述的內容。',
            },
            {
                'use_case_zh': '詳細說明微軟與客戶之間，關於處理與保護客戶資料及個人資料相關義務的法律協議。', 'use_case_en': 'A legal agreement that details the obligations between Microsoft and a customer regarding the processing and security of customer data and personal data.',
                'answer_zh': '線上服務條款', 'answer_en': 'Online Services Terms',
                'explain_zh': '線上服務條款是微軟與客戶之間的法律協議，明訂雙方在客戶資料與個人資料的處理及安全性方面各自的義務。',
            },
            {
                'use_case_zh': '定義線上服務的資料處理與安全條款，包括已處理資料的揭露，以及資料的傳輸、保留與刪除。', 'use_case_en': 'Defines the data processing and security terms for online services, including the disclosure of processed data and the transfer, retention, and deletion of data.',
                'answer_zh': '資料保護附錄', 'answer_en': 'Data Protection Addendum',
                'explain_zh': '資料保護附錄專門定義線上服務中資料處理與安全相關的條款細節，涵蓋資料揭露、跨境傳輸、保留期限與刪除等具體規範。',
            },
        ],
    },
    348: {
        'stem_zh': '將 Azure 運算服務與其適當的描述配對。',
        'stem_en': 'Match the Azure compute services to the appropriate descriptions.',
        'pool_zh': ['Azure App Service', 'Azure Container Instances', 'Azure Functions', 'Azure 虛擬機器擴展集'],
        'pool_en': ['Azure App Service', 'Azure Container Instances', 'Azure Functions', 'Azure Virtual Machine Scale Sets'],
        'matches': [
            {
                'use_case_zh': '提供實體電腦的軟體模擬。', 'use_case_en': 'Provides software emulation of a physical computer.',
                'answer_zh': 'Azure 虛擬機器擴展集', 'answer_en': 'Azure Virtual Machine Scale Sets',
                'explain_zh': '虛擬機器擴展集是由多台採用相同設定的虛擬機器組成，而虛擬機器本身就是以軟體模擬出一台完整實體電腦的運算資源，因此符合這個描述。',
            },
            {
                'use_case_zh': '提供作業系統虛擬化。', 'use_case_en': 'Provides operating system virtualization.',
                'answer_zh': 'Azure Container Instances', 'answer_en': 'Azure Container Instances',
                'explain_zh': '容器技術是在作業系統層級進行虛擬化，讓多個容器共用同一個作業系統核心，Container Instances 正是以此方式快速執行容器化應用程式。',
            },
        ],
    },
    365: {
        'stem_zh': '你應該如何計算每月正常執行時間百分比？',
        'stem_en': 'How should you calculate the monthly uptime percentage?',
        'pool_zh': ['停機分鐘數', '最大可用分鐘數', '(最大可用分鐘數 – 停機分鐘數)', '60', '1,440', '100', '99.99'],
        'pool_en': ['Downtime in Minutes', 'Maximum Available Minutes', '(Maximum Available Minutes – Downtime in Minutes)', '60', '1,440', '100', '99.99'],
        'matches': [
            {
                'use_case_zh': '公式中的第一個空格（分子）', 'use_case_en': 'First blank in the formula (numerator)',
                'answer_zh': '(最大可用分鐘數 – 停機分鐘數)', 'answer_en': '(Maximum Available Minutes – Downtime in Minutes)',
                'explain_zh': '這代表當月實際保持正常運作的分鐘數，也就是最大可用分鐘數減去停機分鐘數，是計算正常執行時間百分比的分子。',
            },
            {
                'use_case_zh': '公式中的第二個空格（分母）', 'use_case_en': 'Second blank in the formula (denominator)',
                'answer_zh': '最大可用分鐘數', 'answer_en': 'Maximum Available Minutes',
                'explain_zh': '這是當月理論上的總可用分鐘數，作為公式的分母，用來與實際正常運作的時間相除，得出可用性比例。',
            },
            {
                'use_case_zh': '公式中的第三個空格（乘數）', 'use_case_en': 'Third blank in the formula (multiplier)',
                'answer_zh': '100', 'answer_en': '100',
                'explain_zh': '將實際運作時間與最大可用時間的比值乘以 100，才能把結果換算成百分比呈現。',
            },
        ],
    },
    386: {
        'stem_zh': '將雲端運算的優勢與其適當的需求配對。',
        'stem_en': 'Match the cloud computing benefits to the appropriate requirements.',
        'pool_zh': ['災害復原', '異地分佈', '高可用性', '可擴充性'],
        'pool_en': ['Disaster recovery', 'Geo-distribution', 'High availability', 'Scalability'],
        'matches': [
            {
                'use_case_zh': '在資源發生故障時，仍提供不中斷的使用者體驗。', 'use_case_en': 'Provide a continuous user experience in the event of a resource failure.',
                'answer_zh': '高可用性', 'answer_en': 'High availability',
                'explain_zh': '高可用性透過備援與容錯移轉機制，確保單一資源故障時服務仍能持續運作，使用者幾乎感受不到中斷。',
            },
            {
                'use_case_zh': '將應用程式與資料部署到鄰近使用者的區域資料中心。', 'use_case_en': 'Deploy apps and data to regional data centers that are located close to users.',
                'answer_zh': '異地分佈', 'answer_en': 'Geo-distribution',
                'explain_zh': '異地分佈讓你可以把應用程式與資料部署到全球各地、鄰近使用者的資料中心，藉此降低延遲並改善使用體驗。',
            },
            {
                'use_case_zh': '可透過為虛擬機器增加記憶體或 CPU，動態提升運算容量。', 'use_case_en': 'Compute capacity can be increased dynamically by adding RAM or CPU to a virtual machine.',
                'answer_zh': '可擴充性', 'answer_en': 'Scalability',
                'explain_zh': '可擴充性指依需求動態調整資源規模的能力，包括垂直擴充（為現有虛擬機器增加 CPU、記憶體等資源），正是題目描述的情境。',
            },
        ],
    },
    387: {
        'stem_zh': '將 Azure 服務與其適當的描述配對。',
        'stem_en': 'Match the Azure services to the appropriate descriptions.',
        'pool_zh': ['ExpressRoute', '虛擬網路對等互連', 'VPN 閘道'],
        'pool_en': ['ExpressRoute', 'Virtual network peering', 'VPN gateway'],
        'matches': [
            {
                'use_case_zh': '透過私人連線將地端網路延伸到 Microsoft 雲端', 'use_case_en': 'Extends on-premises networks to the Microsoft cloud via a private connection',
                'answer_zh': 'ExpressRoute', 'answer_en': 'ExpressRoute',
                'explain_zh': 'ExpressRoute 透過連線供應商建立不經過公用網際網路的私人專用連線，把地端網路延伸到 Microsoft 雲端，提供更高的頻寬與穩定性。',
            },
            {
                'use_case_zh': '將兩個以上的 Azure 虛擬網路合併成一個邏輯上的虛擬網路', 'use_case_en': 'Combines two or more Azure virtual networks into a single logical virtual network',
                'answer_zh': '虛擬網路對等互連', 'answer_en': 'Virtual network peering',
                'explain_zh': '虛擬網路對等互連讓兩個以上的虛擬網路之間的資源可以透過 Microsoft 骨幹網路直接通訊，形同合併成一個邏輯上的虛擬網路。',
            },
            {
                'use_case_zh': '透過公用網路提供從地端網路連線到 Azure 的加密連線', 'use_case_en': 'Provides an encrypted connection from on-premises networks to Azure via a public network',
                'answer_zh': 'VPN 閘道', 'answer_en': 'VPN gateway',
                'explain_zh': 'VPN 閘道透過網際網路（公用網路）建立加密的通道，讓地端網路可以安全地連線到 Azure 虛擬網路，不需要專用實體連線。',
            },
        ],
    },
    395: {
        'stem_zh': '將 Azure 儲存體服務與其適當的描述配對。',
        'stem_en': 'Match the Azure storage services to the appropriate descriptions.',
        'pool_zh': ['Azure Blob 儲存體', 'Azure Disk 儲存體', 'Azure Files', 'Azure Queue 儲存體'],
        'pool_en': ['Azure Blob storage', 'Azure Disk storage', 'Azure Files', 'Azure Queue Storage'],
        'matches': [
            {
                'use_case_zh': '用於應用程式之間可靠的訊息傳遞', 'use_case_en': 'Used for reliable messaging between applications',
                'answer_zh': 'Azure Queue 儲存體', 'answer_en': 'Azure Queue Storage',
                'explain_zh': 'Queue 儲存體是雲端訊息佇列服務，讓應用程式元件之間可以非同步、可靠地傳遞大量訊息，元件之間不需要同時上線。',
            },
            {
                'use_case_zh': '可從 Windows 裝置以網路共用的方式存取', 'use_case_en': 'Can be accessed as a network share from a Windows device',
                'answer_zh': 'Azure Files', 'answer_en': 'Azure Files',
                'explain_zh': 'Azure Files 提供完全受控的檔案共用服務，支援 SMB 通訊協定，因此可以像連接一般網路磁碟機一樣，直接從 Windows 裝置掛載存取。',
            },
            {
                'use_case_zh': '可以設定使用封存 (Archive) 存取層', 'use_case_en': 'Can be configured to use the Archive access tier',
                'answer_zh': 'Azure Blob 儲存體', 'answer_en': 'Azure Blob storage',
                'explain_zh': '封存存取層是 Blob 儲存體特有的存取層級，專為極少存取、可容忍數小時取回延遲的資料設計，用來大幅降低長期保存的儲存成本。',
            },
        ],
    },
    464: {
        'stem_zh': '你需要確定在 Azure 入口網站中，必須使用哪些 blade 來執行以下工作：\n- 檢視安全性建議。\n- 監視 Azure 服務的健康狀態。\n你應該為每項工作識別哪個 blade？',
        'stem_en': 'You need to identify which blades in the Azure portal must be used to perform the following tasks:\n- View security recommendations.\n- Monitor the health of Azure services.\nWhich blade should you identify for each task?',
        'pool_zh': ['監視器 (Monitor)', '訂用帳戶 (Subscriptions)', '市集 (Marketplace)', 'advisor (顧問)'],
        'pool_en': ['Monitor', 'Subscriptions', 'Marketplace', 'Advisor'],
        'matches': [
            {
                'use_case_zh': '監視 Azure 服務的健康狀態', 'use_case_en': 'Monitor the health of Azure services',
                'answer_zh': '監視器 (Monitor)', 'answer_en': 'Monitor',
                'explain_zh': '監視器 (Monitor) 是 Azure 入口網站中用來收集、分析 Azure 資源效能指標與診斷記錄的主要工具，可用來監視 Azure 服務的健康狀態。',
            },
            {
                'use_case_zh': '檢視安全性建議', 'use_case_en': 'View security recommendations',
                'answer_zh': 'advisor (顧問)', 'answer_en': 'Advisor',
                'explain_zh': 'advisor (顧問) 會分析你的資源設定，提供安全性、成本、效能與可靠性等方面的最佳化建議，是檢視安全性建議的正確工具。',
            },
        ],
    },
    469: {
        'stem_zh': '將驗證方法與其適當的安全性等級配對。',
        'stem_en': 'Match the authentication method to the appropriate level of security.',
        'pool_zh': ['多重要素驗證 (MFA)', '密碼驗證', '無密碼驗證'],
        'pool_en': ['Multifactor authentication (MFA)', 'Password authentication', 'Passwordless authentication'],
        'matches': [
            {
                'use_case_zh': '安全性高，但使用起來較不方便', 'use_case_en': 'High security, but inconvenient to use',
                'answer_zh': '多重要素驗證 (MFA)', 'answer_en': 'Multifactor authentication (MFA)',
                'explain_zh': '多重要素驗證需要結合密碼與另一項驗證因素（例如手機驗證碼），大幅提高了安全性，但使用者每次登入都要多一個步驟，因此便利性較低。',
            },
            {
                'use_case_zh': '安全性低，但使用起來方便', 'use_case_en': 'Low security, but convenient to use',
                'answer_zh': '密碼驗證', 'answer_en': 'Password authentication',
                'explain_zh': '傳統密碼驗證只需要輸入一組密碼即可登入，使用上最方便，但密碼容易被猜測、外洩或重複使用，因此安全性是三者中最低的。',
            },
            {
                'use_case_zh': '安全性高，且使用起來方便', 'use_case_en': 'High security and convenient to use',
                'answer_zh': '無密碼驗證', 'answer_en': 'Passwordless authentication',
                'explain_zh': '無密碼驗證（如生物辨識或硬體金鑰）不必記憶或輸入密碼，同時因為採用生物特徵或裝置金鑰等方式，安全性也優於傳統密碼，兼具高安全性與高便利性。',
            },
        ],
    },
    472: {
        'stem_zh': '將雲端服務與其適當的描述配對。',
        'stem_en': 'Match the cloud service to the appropriate description.',
        'pool_zh': ['基礎設施即服務 (IaaS)', '平台即服務 (PaaS)', '軟體即服務 (SaaS)'],
        'pool_en': ['Infrastructure as a service (IaaS)', 'Platform as a service (PaaS)', 'Software as a service (SaaS)'],
        'matches': [
            {
                'use_case_zh': '對雲端環境提供最完整的控制權。', 'use_case_en': 'Provides the most control of a cloud environment.',
                'answer_zh': '基礎設施即服務 (IaaS)', 'answer_en': 'Infrastructure as a service (IaaS)',
                'explain_zh': 'IaaS 讓使用者自行管理作業系統、儲存體與網路設定，是三種模型中使用者能掌控最多環境細節的一種。',
            },
            {
                'use_case_zh': '在不需要維護作業系統的前提下，提供資料庫設計的最大控制權。', 'use_case_en': 'Provides the most control of a database design without having to maintain the operating system.',
                'answer_zh': '平台即服務 (PaaS)', 'answer_en': 'Platform as a service (PaaS)',
                'explain_zh': 'PaaS 由平台代管底層作業系統與執行環境，使用者不需要維護作業系統，卻仍能完整掌控資料庫結構描述、索引等設計層面的細節。',
            },
            {
                'use_case_zh': '用來裝載 Azure 虛擬機器。', 'use_case_en': 'Used to host Azure virtual machines.',
                'answer_zh': '基礎設施即服務 (IaaS)', 'answer_en': 'Infrastructure as a service (IaaS)',
                'explain_zh': '虛擬機器本身就是 IaaS 的定義性服務——使用者取得虛擬化的運算資源，並自行安裝、設定與管理其上的作業系統。',
            },
        ],
    },
}

ORDERING2 = {
    227: {
        'stem_zh': '在 Azure 的縱深防禦 (defense-in-depth) 模型中，由外而內依序包含哪些防護層？請按照從最外層到最內層的順序排列。',
        'stem_en': 'In the Azure defense-in-depth model, which layers protect resources from the outermost to the innermost? Arrange the layers in order from outermost to innermost.',
        'steps': [
            ('Physical Security', '實體安全'),
            ('Identity & Access', '身分與存取'),
            ('Perimeter', '周邊'),
            ('Network', '網路'),
            ('Compute', '計算'),
            ('Application', '應用程式'),
            ('Data', '資料'),
        ],
        'step_explanations': ['這是縱深防禦的第一道防線，保護實際存放硬體設備的建築物與資料中心，控制誰能實際接觸到伺服器、機櫃等實體設備。', '在實體安全之後，接著要控管基礎設施本身的存取權與變更權限，只授予使用者所需的最小權限，並搭配單一登入與多重要素驗證，稽核所有事件與變更。', '周邊層負責使用分散式阻斷服務攻擊 (DDoS) 防護，過濾大規模攻擊，並用周邊防火牆偵測、警示針對網路的惡意攻擊。', '網路層透過限制資源之間的通訊（預設拒絕、僅允許必要流量）、限制輸入輸出的網際網路存取，並確保與地端網路的安全連線。', '計算層要保護虛擬機器的存取，部署端點防護，並讓系統保持更新與修補，避免惡意軟體或未修補系統帶來的風險。', '應用程式層要確保應用程式本身沒有安全漏洞，將機密資訊存放在安全的儲存介質中，並把安全性納入整個開發生命週期的設計要求。', '資料是攻擊者最終的目標，也是縱深防禦的最內層，儲存與控管資料存取的人員，必須確保資料的機密性、完整性與可用性都受到適當保護。'],
        'explanation_zh': '縱深防禦是由外而內堆疊多層防護的安全模型：實體安全 → 身分與存取 → 周邊 → 網路 → 計算 → 應用程式 → 資料。任何一層被突破，內層的防護仍然可以繼續擋住攻擊，資料始終是最終、也是最重要的保護目標。',
    },
}
