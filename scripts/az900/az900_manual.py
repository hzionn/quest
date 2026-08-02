#!/usr/bin/env python3
"""來源沒有 AI 解析段、內容只存在於截圖裡的那 25 題，人工轉錄＋撰寫解析。

其餘 449 題都是從 PDF 的文字層程式轉出來的（見 build_az900.py）。這裡的
25 題是例外：
  ・19 題 HOTSPOT —— 陳述與答案只在 Answer Area 截圖裡，用 render_az900.py
    把圖切出來逐張讀，再把陳述與 Yes/No 轉錄下來。
  ・6 題單選／複選 —— 有選項有答案，但 PDF 排版把解析文字打散黏進選項行，
    程式切不乾淨，所以解析改由人寫。

YESNO 的每個項目是 (英文陳述, 中文陳述, 是否為真, 中文解析)。
"""

# 是非型 HOTSPOT 的題幹是固定樣板，不逐題重寫。
YESNO_STEM_ZH = '針對下列每一項陳述，若陳述為真請選「是」，否則請選「否」。（每個正確選擇得一分）'
YESNO_STEM_EN = ('For each of the following statements, select Yes if the statement is true. '
                 'Otherwise, select No. NOTE: Each correct selection is worth one point.')

YESNO = {
    35: {
        'items': [
            ('Azure provides flexibility between capital expenditure (CapEx) and operational expenditure (OpEx).',
             'Azure 讓企業能在資本支出 (CapEx) 與營運支出 (OpEx) 之間彈性選擇。', True,
             '雲端費用是「用多少付多少、當期認列」，屬於營運支出；自己買伺服器建機房則是資本支出。'
             '企業可以決定哪些工作負載留在自有硬體、哪些搬上 Azure，也可以用保留執行個體預先付費，'
             '兩種支出模式之間確實有調整空間。'),
            ('If you create two Azure virtual machines that use the B2S size, each virtual machine will always '
             'generate the same monthly costs.',
             '如果你建立兩台都使用 B2S 大小的 Azure 虛擬機器，兩台每月的費用一定會相同。', False,
             'VM 的月費不是只看大小。區域單價不同、作業系統授權不同（Windows 比 Linux 貴）、'
             '附掛的受控磁碟大小與類型、輸出流量、實際開機時數、有沒有套用保留或 Azure Hybrid Benefit，'
             '都會讓兩台同規格 VM 的帳單差很多。'),
            ('When an Azure virtual machine is stopped, you continue to pay storage costs associated to the '
             'virtual machine.',
             '當 Azure 虛擬機器停止時，你仍須繼續支付與該虛擬機器相關的儲存體費用。', True,
             '停止（即使是「停止並解除配置」）停掉的只有運算費用。VM 的 OS 磁碟與資料磁碟還在，'
             '受控磁碟是按「配置容量」計費的，所以磁碟費用照算。要完全不付費得把 VM 連同磁碟一起刪除。'),
        ],
        'full': '三個判斷分別對應：雲端的費用模式（CapEx／OpEx）、VM 計價由哪些項目組成、'
                '以及「停機不等於不收費」——運算停了，儲存體還在算錢。',
    },
    48: {
        'items': [
            ('To achieve a hybrid cloud model, a company must always migrate from a private cloud model.',
             '要做到混合雲模式，企業一定得先從私有雲模式移轉過來。', False,
             '混合雲只是「私有（含內部部署）與公有雲並用且互通」。起點可以是傳統的內部部署機房，'
             '也可以是本來就在公有雲、後來才加上內部部署資源，沒有「一定要先有私有雲再移轉」這種前提。'),
            ('A company can extend the capacity of its internal network by using the public cloud.',
             '企業可以利用公有雲來擴充自己內部網路的容量。', True,
             '這正是混合雲最常見的用法：用 VPN 或 ExpressRoute 把內部網路接到 Azure 虛擬網路，'
             '尖峰時把額外的運算或儲存放到雲端，不必為了短期尖峰去採購硬體。'),
            ('In a public cloud model, only guest users at your company can access the resources in the cloud.',
             '在公有雲模式中，只有公司的來賓使用者才能存取雲端上的資源。', False,
             '誰能存取是由你設定的身分與存取控制決定的（Entra ID 帳戶、RBAC、網路規則），跟「來賓使用者」無關。'
             '公有雲指的是基礎設施由雲端供應商擁有、多個租用戶共享，不是在限制哪一類人才能存取。'),
        ],
        'full': '三句都在測「公有／私有／混合雲」的定義。混合雲看的是兩邊並用與互通，'
                '不是移轉路徑；公有雲講的是基礎設施的所有權與共享方式，不是存取權限。',
    },
    62: {
        'items': [
            ('A company can extend a private cloud by adding its own physical servers to the public cloud.',
             '企業可以把自己的實體伺服器加進公有雲，藉此擴充私有雲。', False,
             '公有雲的硬體是雲端供應商擁有並維運的，你不能把自己的機器搬進去。'
             '要用自有硬體延伸，方向是反過來的——在自己的機房部署 Azure Stack HCI／Azure Arc，'
             '把 Azure 的管理平面延伸到本地。'),
            ('To build a hybrid cloud, you must deploy resources to the public cloud.',
             '要建立混合雲，你一定得把資源部署到公有雲。', False,
             '混合雲強調的是「內部部署與雲端互相連通，工作負載可以放在最適合的位置」。'
             '把兩邊接起來（VPN／ExpressRoute）、或只使用雲端的身分與管理服務，都已經構成混合架構，'
             '不是非得在公有雲上布建工作負載不可。這題官方咬的是「must deploy」這個絕對說法。'),
            ('A private cloud must be disconnected from the internet.',
             '私有雲必須與網際網路中斷連線。', False,
             '私有雲的定義是「基礎設施專屬於單一組織」，跟有沒有連上網際網路無關。'
             '絕大多數私有雲都對外連網，好讓遠端員工與分公司存取，只是邊界由組織自己控管。'),
        ],
        'full': '三句都是「絕對化」的陷阱句：加自己的伺服器到公有雲、一定要部署到公有雲、'
                '一定要離線——雲端部署模型講的是所有權與使用方式，沒有這些硬性條件。',
    },
    64: {
        'items': [
            ('A platform as a service (PaaS) solution that hosts web apps in Azure provides full control of the '
             'operating systems that host applications.',
             '在 Azure 上託管 Web 應用程式的平台即服務 (PaaS) 解決方案，可讓你完全控制承載應用程式的作業系統。',
             False,
             'PaaS 的重點就是把作業系統交給平台管理。以 Azure App Service 為例，'
             '底層雖然跑在 Windows／Linux 機器上，但你拿不到 OS 的管理權，也不需要自己上修補程式。'
             '要完全掌控作業系統就得改用 IaaS（虛擬機器）。'),
            ('A Platform as a Service (PaaS) solution that hosts web apps in Azure can be provided with additional '
             'memory by changing the pricing tier.',
             '在 Azure 上託管 Web 應用程式的 PaaS 解決方案，可以透過變更定價層來取得額外的記憶體。', True,
             'App Service 方案的每一個定價層（B1、S1、P1v3…）都對應固定的 CPU 與記憶體規格，'
             '升級定價層就是換到規格更大的執行個體，屬於縱向擴充。'),
            ('A Platform as a Service (PaaS) solution that hosts web apps in Azure can be configured to '
             'automatically scale the number of instances based on demand.',
             '在 Azure 上託管 Web 應用程式的 PaaS 解決方案，可以設定成依需求自動調整執行個體數量。', True,
             '這就是自動調整 (autoscale)：依 CPU、記憶體、佇列長度或排程規則自動增減執行個體數量，'
             '屬於橫向擴充，不需要你自己布建機器。'),
        ],
        'full': 'PaaS 的分界線：作業系統歸平台管（所以第一句錯），但資源規模歸你調——'
                '換定價層是縱向擴充（第二句對），自動增減執行個體是橫向擴充（第三句對）。',
    },
    75: {
        'items': [
            ('Azure Files is an example of infrastructure as a service (IaaS).',
             'Azure Files 是基礎設施即服務 (IaaS) 的例子。', False,
             'Azure Files 是完全受控的 SMB／NFS 檔案共用服務，你不用管底層伺服器與作業系統，屬於 PaaS。'
             'IaaS 的代表是 Azure 虛擬機器。'),
            ('A DNS server that runs on an Azure virtual machine is an example of platform as a service (PaaS).',
             '在 Azure 虛擬機器上執行的 DNS 伺服器是平台即服務 (PaaS) 的例子。', False,
             '只要是你自己開虛擬機器、自己安裝軟體、自己維護作業系統，那就是 IaaS。'
             'Azure 的 PaaS 版名稱服務是 Azure DNS。'),
            ('Microsoft Intune is an example of software as a service (SaaS).',
             'Microsoft Intune 是軟體即服務 (SaaS) 的例子。', True,
             'Intune 是微軟託管的裝置與應用程式管理服務，直接訂閱就能用，不需要架任何伺服器，是典型的 SaaS。'),
        ],
        'full': '判斷服務模型的簡單方法：作業系統要不要你管？要管就是 IaaS；不用管但你還要部署自己的程式，'
                '是 PaaS；連程式都是別人寫好、你只是訂閱來用，就是 SaaS。',
    },
    119: {
        'items': [
            ('Data that is stored in an Azure Storage account automatically has at least three copies.',
             '存放在 Azure 儲存體帳戶中的資料，自動至少會有三份複本。', True,
             '即使是最低階的本機備援儲存體 (LRS)，也會在同一個資料中心內同步保留三份複本；'
             'ZRS 與 GRS 只是把複本放得更分散。'),
            ('All data that is copied to an Azure Storage account is backed up automatically to another Azure '
             'data center.',
             '複製到 Azure 儲存體帳戶的所有資料，都會自動備份到另一個 Azure 資料中心。', False,
             '要不要跨資料中心或跨區域，取決於你選的備援選項：LRS 只留在單一資料中心，'
             '要複製到另一個區域得選 GRS／RA-GRS。而且「備援」不等於「備份」——誤刪會同步刪掉。'),
            ('An Azure Storage account can contain up to 2 TB of data and up to one million files.',
             '一個 Azure 儲存體帳戶最多只能存放 2 TB 的資料與一百萬個檔案。', False,
             '儲存體帳戶的容量上限是 PB 等級，檔案數量也沒有一百萬這種限制。'
             '2 TB 比較像單一磁碟或舊版檔案共用的上限，不是儲存體帳戶的。'),
        ],
        'full': '重點是「三份複本是最低保證」「跨區域要自己選 GRS」「備援不等於備份」，'
                '以及儲存體帳戶的容量遠大於題目寫的 2 TB。',
    },
    159: {
        'items': [
            ('Azure resources can only access other resources in the same resource group.',
             'Azure 資源只能存取同一個資源群組內的其他資源。', False,
             '資源群組是管理與生命週期的容器，不是安全或網路邊界。'
             '跨資源群組、甚至跨訂用帳戶的資源，只要權限與網路設定允許就能互相存取。'),
            ('If you delete a resource group, all the resources in the resource group will be deleted.',
             '如果你刪除一個資源群組，群組內的所有資源都會被刪除。', True,
             '刪除資源群組是連同裡面所有資源一起刪掉，這也是為什麼正式環境常會在資源群組上'
             '加「刪除鎖定 (CanNotDelete)」。'),
            ('A resource group can contain resources from multiple Azure regions.',
             '一個資源群組可以包含來自多個 Azure 區域的資源。', True,
             '資源群組本身有一個「位置」，但那只是存放群組中繼資料的地方；'
             '群組內的資源可以分布在任何區域。'),
        ],
        'full': '資源群組是「管理容器」不是「隔離邊界」：不限制互相存取、不限制區域，'
                '但生命週期綁在一起——刪群組就是刪光裡面的東西。',
    },
    242: {
        'items': [
            ('A network security group (NSG) will block all network traffic by default.',
             '網路安全性群組 (NSG) 預設會封鎖所有網路流量。', False,
             'NSG 內建了預設規則：允許同一虛擬網路內的流量、允許 Azure 負載平衡器的探查、'
             '允許所有對外的輸出流量，最後才是拒絕其他所有流量。所以「預設全擋」並不成立。'),
            ('Application security groups can be specified as part of network security group (NSG) rules.',
             '應用程式安全性群組可以指定成網路安全性群組 (NSG) 規則的一部分。', True,
             '應用程式安全性群組 (ASG) 就是設計來當作 NSG 規則的來源或目的地，'
             '讓你用「角色」（例如 web、db）而不是 IP 位址來寫規則。'),
            ('Network security groups (NSGs) always include inbound security rules and outbound security rules.',
             '網路安全性群組 (NSG) 一定同時包含輸入安全性規則與輸出安全性規則。', True,
             '每個 NSG 建立時就自帶三條輸入預設規則與三條輸出預設規則，這些預設規則刪不掉，'
             '只能用優先順序更高的自訂規則去覆寫。'),
        ],
        'full': 'NSG 的預設狀態是「內部通、對外出得去、其他擋掉」，不是全擋；'
                '輸入與輸出兩組預設規則一定存在；ASG 則是讓規則可以用角色來寫。',
    },
    270: {
        'items': [
            ('To implement an Azure Multi-Factor Authentication (MFA) solution, you must sync on-premises '
             'identities to the cloud.',
             '要實作 Azure 多重要素驗證 (MFA)，你必須把內部部署的身分同步到雲端。', False,
             'MFA 是套用在 Microsoft Entra ID（原 Azure AD）的帳戶上。純雲端帳戶完全不需要有內部部署 AD，'
             '也不需要同步。只有本來就有內部部署 AD、又想沿用同一組身分時才會用到同步。'),
            ('Two valid methods for Azure Multi-Factor Authentication (MFA) are picture identification and a '
             'passport number.',
             '圖片辨識與護照號碼是 Azure 多重要素驗證 (MFA) 的兩種有效方法。', False,
             'MFA 支援的方法是簡訊、語音來電、Microsoft Authenticator 的通知或驗證碼、OATH 硬體權杖、'
             'FIDO2 安全金鑰、Windows Hello 等。護照號碼只是另一串「你知道的資訊」，'
             '圖片辨識也不是 Entra ID 的驗證方法。'),
            ('Azure Multi-Factor Authentication (MFA) can be required for administrative and non-administrative '
             'user accounts.',
             '可以對系統管理員帳戶與非系統管理員帳戶都要求使用多重要素驗證 (MFA)。', True,
             'MFA 可以套用到任何使用者，通常用條件式存取原則指定對象。'
             '系統管理員因為風險高而被特別建議強制啟用，但不是只有他們能用。'),
        ],
        'full': 'MFA 的三個常見誤解：不需要先做目錄同步、驗證因素必須是「你有的東西」或「你的生物特徵」'
                '而不是另一串知識、以及它適用於所有使用者而不只是管理員。',
    },
    323: {
        'items': [
            ('With a consumption-based plan, you pay a fixed rate for all data sent to or from virtual machines '
             'hosted in the cloud.',
             '使用耗用量計費方案時，所有進出雲端虛擬機器的資料都以固定費率計費。', False,
             '耗用量計費的定義就是「用多少付多少」，不是固定費率。'
             '而且輸入流量通常免費、輸出流量才收費，費率還會依區域與用量級距而不同。'),
            ('With a consumption-based plan, you reduce overall costs by paying only for extra capacity when it '
             'is required.',
             '使用耗用量計費方案時，只在需要額外容量時才付費，因此能降低整體成本。', True,
             '這正是耗用量模式的價值：不必為了尖峰長期養著閒置容量，需要時才擴充、用完就縮回去。'),
            ('Serverless computing is an example of a consumption-based plan.',
             '無伺服器運算是耗用量計費方案的例子。', True,
             'Azure Functions 的取用方案 (Consumption plan) 依執行次數與執行時間計費，'
             '沒有請求就幾乎不產生費用，是最典型的耗用量模式。'),
        ],
        'full': '耗用量計費 = 依實際用量計價、可隨需求伸縮；「固定費率」正好是它的相反面。',
    },
    324: {
        'items': [
            ('The cost of Azure resources can vary between regions.',
             'Azure 資源的費用會因區域而不同。', True,
             '各區域的電力、土地、稅制與營運成本不同，同一種 VM 大小在不同區域的單價確實不一樣，'
             '所以用定價計算機估價時一定要指定區域。'),
            ('An Azure reservation is used to reserve server capacity at a specific data center.',
             'Azure 保留 (reservation) 是用來在特定資料中心保留伺服器容量。', False,
             '保留是一種「預付一年或三年用量換折扣」的計費工具，並不保證實體容量。'
             '要保證容量是另一個功能：容量保留 (capacity reservation)。'),
            ('You can stop an Azure SQL Database instance to decrease costs.',
             '你可以停止 Azure SQL Database 執行個體以降低費用。', False,
             'Azure SQL Database 沒有「停止」這個動作。要省錢的做法是改用無伺服器計算層讓它自動暫停、'
             '調降服務層級，或直接刪除並保留備份。可以「停止」的是虛擬機器。'),
        ],
        'full': '三個常見的成本誤解：價格會依區域浮動（對）、保留是折扣不是佔位（錯）、'
                'PaaS 資料庫不能像 VM 一樣停機省錢（錯）。',
    },
    326: {
        'items': [
            ('The Service Level Agreement (SLA) guaranteed uptime for paid Azure services is at least 99.9 percent.',
             '付費 Azure 服務的服務等級協定 (SLA) 保證正常運作時間至少為 99.9%。', True,
             '付費服務的 SLA 基準大多從 99.9% 起跳，部分設定（跨可用性區域、多執行個體）可以更高。'
             '免費層與預覽版服務則通常不提供 SLA。'),
            ('Companies can increase the Service Level Agreement (SLA) guaranteed uptime by adding Azure '
             'resources to multiple regions.',
             '企業可以把 Azure 資源部署到多個區域，藉此提高 SLA 保證的正常運作時間。', True,
             '把相同服務部署到多個區域或多個可用性區域之後，整體可用性是複合計算的，'
             '實際能達到的正常運作時間會高於單一部署的 SLA。'),
            ('Companies can increase the Service Level Agreement (SLA) guaranteed uptime by purchasing multiple '
             'subscriptions.',
             '企業可以藉由購買多個訂用帳戶來提高 SLA 保證的正常運作時間。', False,
             '訂用帳戶只是計費與資源的容器，跟服務的可用性無關。'
             '買十個訂用帳戶但服務全部擠在同一個區域的同一組執行個體上，可用性一點都不會改善。'),
        ],
        'full': '提高可用性靠的是「把東西放在更多互相獨立的地方」——多可用性區域、多區域；'
                '買更多訂用帳戶只是換一個帳本，跟故障隔離無關。',
    },
    334: {
        'items': [
            ('Storing 1 TB of data in Azure Blob storage will always cost the same, regardless of the Azure '
             'region in which the data is located.',
             '在 Azure Blob 儲存體存放 1 TB 資料，不論資料位於哪個 Azure 區域，費用都相同。', False,
             'Blob 儲存體的單價會依區域而不同，也會依存取層（經常、非經常、封存）'
             '與備援選項（LRS／ZRS／GRS）而不同。'),
            ('When you use a general-purpose v2 Azure Storage account, you are only charged for the amount of '
             'data that is stored. All read and write operations are free.',
             '使用一般用途 v2 儲存體帳戶時，只會依儲存的資料量計費，所有讀取與寫入作業都是免費的。', False,
             'GPv2 帳戶除了容量費用之外，還會針對交易（讀寫作業）、資料擷取與輸出流量分別計費。'
             '非經常存取層與封存層的儲存單價較低，但交易與擷取費用反而更高。'),
            ('Transferring data between Azure Storage accounts in different Azure regions is free.',
             '在不同 Azure 區域的儲存體帳戶之間傳輸資料是免費的。', False,
             '跨區域傳輸屬於輸出流量，是要收費的。只有輸入流量與同一區域內的傳輸才多半免費。'),
        ],
        'full': '儲存體的帳單有三塊：容量、交易、輸出流量。三句話各踩一塊——'
                '容量單價看區域、交易不免費、跨區域傳輸要錢。',
    },
    335: {
        'items': [
            ('In Azure Active Directory Premium P2, at least 99.9 percent availability is guaranteed.',
             'Azure Active Directory Premium P2 保證至少 99.9% 的可用性。', True,
             'Microsoft Entra ID（原 Azure AD）的付費層 P1／P2 提供 99.9% 的 SLA。'),
            ('The Service Level Agreement (SLA) for Azure Active Directory Premium P2 is the same as the SLA for '
             'Azure Active Directory Free.',
             'Azure Active Directory Premium P2 的 SLA 與 Azure Active Directory 免費版相同。', False,
             '免費層沒有 SLA。SLA 是付費層才有的服務承諾，這也是免費與付費層之間最實際的差別之一。'),
            ('All paying Azure customers receive a credit if their monthly uptime percentage is below the '
             'guaranteed amount in the Service Level Agreement (SLA).',
             '若每月正常運作時間低於 SLA 保證值，所有付費的 Azure 客戶都能取得抵免。', True,
             'SLA 未達標的補償方式是服務抵免 (service credit)，也就是折抵後續帳單。'
             '要注意這是抵免不是現金賠償，而且通常要由客戶主動提出申請。'),
        ],
        'full': 'SLA 三件事：付費層才有承諾、免費層沒有、未達標的補償是服務抵免而不是退現金。',
    },
    350: {
        'items': [
            ('A company has complete control of the resources and security for its private cloud.',
             '企業對自己的私有雲擁有資源與安全性的完整控制權。', True,
             '私有雲的基礎設施專屬於單一組織，硬體、網路與安全性都由該組織自己（或其委外廠商代其）掌控，'
             '代價是所有維運責任也一併由自己承擔。'),
            ('A hybrid cloud solution enables a company to control whether its applications run on-premises or '
             'in the cloud.',
             '混合雲解決方案讓企業能決定應用程式要在內部部署還是在雲端執行。', True,
             '這就是混合雲的價值：工作負載可以放在最適合的位置，並依法規、延遲或成本考量隨時調整。'),
            ('Companies are responsible for capital expenditure when they scale up a virtual machine hosted in a '
             'public cloud.',
             '在公有雲擴充虛擬機器規格時，企業需要負擔資本支出。', False,
             '在公有雲擴充 VM 規格不需要採購任何硬體，費用是依用量計費的營運支出 (OpEx)。'
             '資本支出是自己買設備才會發生的。'),
        ],
        'full': '私有雲＝控制權最大、責任也最大；混合雲＝可以選擇工作負載放哪裡；'
                '公有雲擴充＝營運支出，不是資本支出。',
    },
    353: {
        'items': [
            ('The cost of outbound traffic from Azure is the same for all Azure regions.',
             '從 Azure 輸出流量的費用在所有 Azure 區域都相同。', False,
             '輸出流量是分區計價的，例如北美與歐洲屬於同一個價格區間，南美、澳洲的費率就明顯較高，'
             '並不是全球一致。'),
            ('Purchasing Azure services through an Enterprise Agreement (EA) requires you to spend a '
             'predetermined amount.',
             '透過企業合約 (EA) 採購 Azure 服務時，必須先承諾一筆預定的消費金額。', True,
             'EA 是與微軟簽訂的量體承諾合約，需要預先承諾一筆金額（貨幣承諾），'
             '換取折扣、統一計費與合約層級的支援。'),
            ('Microsoft defines the pricing structure of all third-party services sold through Azure Marketplace.',
             'Azure Marketplace 上所有第三方服務的計價架構都是由 Microsoft 定義的。', True,
             '第三方發行者自己決定價格數字，但只能從 Marketplace 提供的計費模式裡挑'
             '（免費、試用、自帶授權 BYOL、依月計費、依用量計費），這套計費架構由微軟定義，'
             '並且統一透過你的 Azure 帳單收取。'),
        ],
        'full': '這題三句分別對應：輸出流量分區計價、EA 需要金額承諾、'
                '以及 Marketplace 的第三方服務雖然自訂價格，但計費模式由微軟框定。',
    },
    361: {
        'items': [
            ('With Azure Reservations, you pay less for virtual machines than with pay-as-you-go pricing.',
             '使用 Azure 保留時，虛擬機器的費用會比隨用隨付更便宜。', True,
             '承諾使用一年或三年可以換到相對隨用隨付相當可觀的折扣，'
             '代價是這段期間內都要付這筆錢，適合長期穩定的工作負載。'),
            ('Two Azure virtual machines that use the B2S size have the same monthly costs.',
             '兩台使用 B2S 大小的 Azure 虛擬機器，每月費用相同。', False,
             '同樣是 B2S，費用仍會因區域單價、作業系統授權、附掛磁碟、輸出流量、'
             '實際執行時數以及有沒有套用保留而不同。'),
            ('When an Azure virtual machine is stopped, you continue to pay storage costs for the virtual machine.',
             '當 Azure 虛擬機器停止時，你仍須繼續支付該虛擬機器的儲存體費用。', True,
             '停止只會停掉運算費用，OS 磁碟與資料磁碟仍佔用受控磁碟的配置容量，照樣計費。'),
        ],
        'full': '跟第 35 題同一組觀念：保留換折扣、同規格不等於同帳單、停機不等於零費用。',
    },
    419: {
        'items': [
            ('You can assign an Azure policy to a virtual machine.',
             '你可以把 Azure 原則指派給一台虛擬機器。', True,
             '原則的指派範圍可以是管理群組、訂用帳戶、資源群組，也可以直接指到單一資源。'),
            ('If an Azure policy is assigned to a resource group, noncompliant resources are removed from the group.',
             '如果把 Azure 原則指派給資源群組，不合規的資源會被移出該群組。', False,
             'Azure 原則不會刪除或搬移既有資源。已存在但不符規範的資源只會被標示為「不合規」，'
             '你可以再用補救 (remediation) 工作去修正，但原則本身不會動它們。'),
            ('If an Azure policy is assigned to a resource group, only compliant resources can be deployed to the '
             'group.',
             '如果把 Azure 原則指派給資源群組，之後只有合規的資源才能部署進該群組。', True,
             '使用 Deny 效果的原則會在部署當下就擋下不符規範的資源，所以之後進得來的都是合規的。'),
        ],
        'full': 'Azure 原則管的是「未來的部署」與「合規狀態的可見性」：能擋新的、能標示舊的，'
                '但不會自己去刪掉既有資源。',
    },
    448: {
        'items': [
            ('For the platform as a service (PaaS) cloud service, updating the operating system is the '
             'responsibility of the customer.',
             '在平台即服務 (PaaS) 中，更新作業系統是客戶的責任。', False,
             'PaaS 的作業系統由雲端供應商維護與更新，客戶只負責自己的應用程式與資料。'
             '要自己更新作業系統的是 IaaS。'),
            ('For the infrastructure as a service (IaaS) cloud service, network control is the responsibility of '
             'Microsoft.',
             '在基礎設施即服務 (IaaS) 中，網路控制是 Microsoft 的責任。', False,
             'IaaS 中虛擬網路、子網路、NSG、路由這些設定都是客戶的責任；'
             'Microsoft 負責的是實體網路與資料中心基礎設施。'),
            ('For the software as a service (SaaS) cloud service, identity management is a shared responsibility '
             'between the customer and Microsoft.',
             '在軟體即服務 (SaaS) 中，身分管理是客戶與 Microsoft 的共同責任。', True,
             '不論哪一種服務模型，身分與存取管理都是共同責任：'
             '供應商提供身分平台與控制項，客戶負責建立帳戶、指派權限、啟用 MFA。'),
        ],
        'full': '共同責任模型的記法：實體層永遠是供應商的、資料與帳戶永遠是客戶的，'
                '中間那幾層（作業系統、網路、應用程式）隨服務模型往上或往下移動；'
                '身分與存取管理則是三種模型都共同分擔。',
    },
}


# 有選項有答案、但 PDF 排版把解析黏進選項行、程式切不乾淨的 6 題。
CHOICE = {
    117: {
        'stem_zh': '你應該使用哪一項 Azure 服務，把多個資源的事件收集到一個集中式存放區？',
        'stem_en': 'Which Azure service should you use to collect events from multiple resources into a '
                   'centralized repository?',
        'options': {
            'A': ('Azure Event Hubs', 'Azure 事件中樞 (Azure Event Hubs)'),
            'B': ('Azure Analysis Services', 'Azure Analysis Services'),
            'C': ('Azure Monitor', 'Azure 監視器 (Azure Monitor)'),
            'D': ('Azure Stream Analytics', 'Azure 串流分析 (Azure Stream Analytics)'),
        },
        'answer': ['C'],
        'explanations': {
            'A': '事件中樞是大數據的「事件擷取管線」，用來每秒接收數百萬筆來自應用程式或裝置的事件，'
                 '再轉送給下游處理。它的保留期只有幾天，本質是輸送帶而不是存放區，'
                 '而且它接的是「事件產生者」，不是 Azure 資源本身。',
            'B': 'Analysis Services 是語意模型與 BI 分析引擎，用來替報表建立資料模型，跟事件收集無關。',
            'C': 'Azure 監視器就是 Azure 用來從各種資源收集遙測（記錄檔與計量）並集中存放的服務，'
                 '資料落在 Log Analytics 工作區這個集中式存放區，之後可以用 KQL 查詢、設定警示與圖表。'
                 '「從多個資源收集事件到集中式存放區」講的就是它。',
            'D': '串流分析是即時串流「處理」引擎，負責在資料流動時做查詢與轉換，'
                 '資料來源通常還是事件中樞或 IoT 中樞，它本身不是存放區。',
            '_full': '【答案校正】來源標的建議答案是 A（事件中樞），但社群投票是 50% 對 49% 幾乎平手，'
                     '代表這題本身有爭議。判斷的關鍵在「resources」與「repository」兩個字：'
                     '事件中樞收的是應用程式／裝置產生的事件串流，保留幾天就丟，是管線不是存放區；'
                     'Azure 監視器收的正是 Azure 資源的遙測，並且長期存放在 Log Analytics 工作區。'
                     '因此本題採用 C。',
        },
    },
    148: {
        'stem_zh': '站對站 (Site-to-Site) VPN 的功能是什麼？',
        'stem_en': 'What is a function of a site-to-site VPN?',
        'options': {
            'A': ('provides a secure connection between a computer on a public network and a corporate network',
                  '在公用網路上的電腦與企業網路之間提供安全連線'),
            'B': ('provides a dedicated private connection to Azure that does not travel over the internet',
                  '提供一條到 Azure 的專用私人連線，且不經過網際網路傳輸'),
            'C': ('provides a connection from an on-premises VPN device to an Azure VPN gateway',
                  '提供從內部部署 VPN 裝置到 Azure VPN 閘道的連線'),
        },
        'answer': ['C'],
        'explanations': {
            'A': '這是點對站 (Point-to-Site) VPN 的描述：單一台裝置從任何地方連回網路，適合遠端工作者。'
                 '站對站連的是「整個網路對整個網路」。',
            'B': '這是 ExpressRoute。它透過連線提供者拉一條專線進 Azure，完全不走公用網際網路，'
                 '延遲與頻寬都比 VPN 穩定，價格也高得多。',
            'C': '站對站 VPN 就是在內部部署的 VPN 裝置與 Azure 的 VPN 閘道之間建立 IPsec/IKE 加密通道，'
                 '把整個內部網路接進 Azure 虛擬網路，是混合網路最常見的做法。',
            '_full': '三個選項剛好對應三種混合連線：點對站（單一裝置）、站對站（整個網路，走網際網路但加密）、'
                     'ExpressRoute（專線，不走網際網路）。',
        },
    },
    157: {
        'stem_zh': 'ExpressRoute 運作在哪一個 OSI 層？',
        'stem_en': 'At which OSI layer does ExpressRoute operate?',
        'options': {
            'A': ('Layer 2', '第 2 層'),
            'B': ('Layer 3', '第 3 層'),
            'C': ('Layer 5', '第 5 層'),
            'D': ('Layer 7', '第 7 層'),
        },
        'answer': ['B'],
        'explanations': {
            'A': '第 2 層是資料連結層，處理的是訊框與 MAC 位址。ExpressRoute 的線路底層雖然可能跑在'
                 '電信商的第 2 層網路上，但你和 Azure 之間建立的是第 3 層對等互連。',
            'B': 'ExpressRoute 是第 3 層（網路層）連線：你的邊緣路由器與 Microsoft 的路由器之間'
                 '建立 BGP 工作階段，互相交換路由前置詞。',
            'C': '第 5 層是工作階段層，負責建立與終止工作階段，跟 ExpressRoute 的連線方式無關。',
            'D': '第 7 層是應用層。ExpressRoute 是網路層的線路服務，不處理應用層協定。',
            '_full': '記法：ExpressRoute ＝ 用 BGP 交換路由 ＝ 第 3 層。',
        },
    },
    314: {
        'stem_zh': '你的公司打算請 Microsoft 對某個 Azure 環境進行架構檢閱 (architectural review)。'
                   '公司目前使用的是 Basic 支援方案。\n'
                   '你需要為公司推薦一個新的支援方案，而且解決方案必須把成本降到最低。\n'
                   '你應該推薦哪一個支援方案？',
        'stem_en': 'Your company plans to request an architectural review of an Azure environment from Microsoft. '
                   'The company currently has a Basic support plan.\n'
                   'You need to recommend a new support plan for the company. The solution must minimize costs.\n'
                   'Which support plan should you recommend?',
        'options': {
            'A': ('Premier', 'Premier'),
            'B': ('Developer', 'Developer'),
            'C': ('Professional Direct', 'Professional Direct'),
            'D': ('Standard', 'Standard'),
        },
        'answer': ['C'],
        'explanations': {
            'A': 'Premier（現已由 Unified Support 取代）確實包含架構檢閱，但它是最貴的一級，'
                 '題目要求把成本降到最低，所以不選。',
            'B': 'Developer 只提供「一般性的架構指引 (guidance)」，而且僅限上班時間的電子郵件支援，'
                 '沒有架構檢閱。',
            'C': 'Professional Direct 是第一個包含「架構支援：指引與檢閱 (guidance and review)」的方案，'
                 '同時也提供 ProDirect 交付管理、營運支援與教育訓練。'
                 '在有提供架構檢閱的方案裡它最便宜，符合「成本最低」的要求。',
            'D': 'Standard 提供 24×7 的技術支援，但架構支援一樣只到「一般性指引」，沒有檢閱。',
            '_full': 'Azure 支援方案的架構支援分兩級：Developer 與 Standard 只有「指引」，'
                     'Professional Direct 與 Premier／Unified 才有「指引與檢閱」。'
                     '題目要架構檢閱又要最省錢，答案就是 Professional Direct。',
        },
    },
    438: {
        'stem_zh': 'Azure 監視器 (Azure Monitor) 把事件資料儲存在哪裡？',
        'stem_en': 'Where does Azure Monitor store event data?',
        'options': {
            'A': ('an Azure Blob Storage account', 'Azure Blob 儲存體帳戶'),
            'B': ('Azure Storage Queue', 'Azure 儲存體佇列'),
            'C': ('Azure SQL Database', 'Azure SQL Database'),
            'D': ('a Log Analytics workspace', 'Log Analytics 工作區'),
        },
        'answer': ['D'],
        'explanations': {
            'A': 'Blob 儲存體存放的是非結構化資料。你「可以」把診斷記錄額外封存到 Blob 做長期保留，'
                 '但那是自己設定的匯出目的地，不是 Azure 監視器預設存放與查詢事件的地方。',
            'B': '儲存體佇列是非同步訊息傳遞用的，訊息取出後就消失，不是查詢用的資料存放區。',
            'C': 'Azure SQL Database 是關聯式資料庫服務，Azure 監視器並不會把記錄寫進去。',
            'D': 'Azure 監視器的記錄資料存放在 Log Analytics 工作區，用 KQL 查詢，'
                 '也是設定警示、活頁簿與圖表的資料來源。',
            '_full': '記法：Azure 監視器的「計量」走時間序列資料庫、「記錄／事件」走 Log Analytics 工作區。'
                     'Blob 與事件中樞則是可選的匯出目的地，用於長期封存或串接第三方系統。',
        },
    },
    445: {
        'stem_zh': '在基礎設施即服務 (IaaS) 雲端服務模型中，下列哪兩個元件是雲端服務供應商的責任？'
                   '（每個正確答案都是一個完整的解決方案，每個正確選擇得一分）',
        'stem_en': 'In the infrastructure as a service (IaaS) cloud service model, which two components are the '
                   'responsibility of the cloud service provider? Each correct answer presents a complete '
                   'solution. NOTE: Each correct selection is worth one point.',
        'options': {
            'A': ('the configuration and maintenance of storage', '儲存體的設定與維護'),
            'B': ('the installation and configuration of the operating system', '作業系統的安裝與設定'),
            'C': ('maintaining the hardware', '硬體的維護'),
            'D': ('the network configuration', '網路設定'),
            'E': ('physical security of the datacenter infrastructure', '資料中心基礎設施的實體安全'),
        },
        'answer': ['C', 'E'],
        'explanations': {
            'A': '在 IaaS 中，磁碟要開多大、選哪一種效能層級、要不要加密與備份，都是客戶自己設定與維護的。'
                 '供應商負責的是底層的實體儲存硬體。',
            'B': '作業系統的安裝、設定與後續更新是 IaaS 客戶的責任，這正是 IaaS 與 PaaS 的分界點。',
            'C': '實體伺服器、磁碟、網路設備的採購、更換與維護，一律由雲端服務供應商負責，客戶碰不到。',
            'D': '虛擬網路、子網路、NSG 與路由這些網路設定，在 IaaS 中是客戶的責任。',
            'E': '資料中心的門禁、監控與人員管制屬於實體安全，永遠由雲端服務供應商負責。',
            '_full': '共同責任模型裡有兩端是固定的：實體層（硬體、資料中心）永遠是供應商的，'
                     '資料與帳戶存取永遠是客戶的。IaaS 只把「作業系統以上」交給客戶，'
                     '所以選項裡凡是「設定」類的都是客戶責任，「實體」類的才是供應商責任。',
        },
    },
}
