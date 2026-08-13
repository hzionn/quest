// Exhibit tables for the AZ-305 sections whose stem says "shown in the following
// table", transcribed from the page bitmaps.
//
// These tables are images, so `extract_text()` returns a stem that references
// data the reader cannot see. The rows below are appended to the stem in the
// same shape AZ-104 uses for its exhibits: `・` bullets with `｜` between cells.
//
// The tables are English in the source and are left that way in both banks —
// translating them would be inventing content that the source does not have.
//
// Several sections share one table: #32 #35 #37 #38 #41 #44 #45 #47 #48 #210 all
// reference the same division/subscription/tenant table, so it is defined once
// and referenced by each of them.
const DIVISIONS = [
  'Division｜Azure subscription｜Azure AD tenant',
  'East｜Sub1｜Contoso.com',
  'West｜Sub2｜Fabrikam.com',
]

// The Litware case study (topics with the SERVER1-3 / SERVER10 inventory) repeats
// one exhibit across all of its questions.
const LITWARE_SERVERS = [
  'Name｜Type｜Configuration',
  'SERVER1, SERVER2, SERVER3｜Ubuntu 18.04 virtual machines hosted on Hyper-V｜The virtual machines host a third-party app named App1. App1 uses an external storage solution that provides Apache Hadoop-compatible data storage. The data storage supports POSIX access control list (ACL) file-level permissions.',
  'SERVER10｜Server that runs Windows Server 2016｜The server contains a Microsoft SQL Server instance that hosts two databases named DB1 and DB2.',
]

export const EXHIBITS = {
  19: [
    'Division｜Azure subscription｜Azure Active Directory (Azure AD) tenant',
    'East｜Sub1, Sub2｜East.contoso.com',
    'West｜Sub3, Sub4｜West.contoso.com',
  ],
  21: [
    'Name｜Type｜Account Kind｜Location',
    'storage1｜Azure Storage account｜Storage (general purpose v1)｜East US',
    'storage2｜Azure Storage account｜StorageV2 (general purpose v2)｜East US',
    'Workspace1｜Azure Log Analytics workspace｜Not applicable｜East US',
    'Workspace2｜Azure Log Analytics workspace｜Not applicable｜East US',
    'Hub1｜Azure event hub｜Not applicable｜East US',
  ],
  27: [
    'Diagnostic setting name｜Diagnostic1',
    'log SQLInsights｜selected｜Retention 90 days',
    'log AutomaticTuning｜selected｜Retention 30 days',
    'log QueryStoreRuntimeStatistics, QueryStoreWaitStatistics, Errors, DatabaseWaitStatistics, Timeouts, Blocks, Deadlocks｜not selected｜Retention 0',
    'metric Basic｜not selected｜Retention 0',
    'Destination — Send to Log Analytics｜selected｜Workspace sk200814 (eastus)',
    'Destination — Archive to a storage account｜selected｜Location East US, Storage account contoso20',
    'Destination — Stream to an event hub｜not selected',
  ],
  46: [
    'Name｜Management group',
    'Sub1｜MG1',
    'Sub2｜MG2',
    'Sub3｜Tenant Root Group',
    '',
    'Name｜Subscription',
    'RG1｜Sub1',
    'RG2｜Sub2',
    'RG3｜Sub3',
    '',
    'Name｜Member of',
    'Group1｜Group3',
    'Group2｜Group3',
    'Group3｜None',
    '',
    'Name｜Member of',
    'User1｜Group1',
    'User2｜Group2',
    'User3｜Group1, Group2',
  ],
  63: [
    'Name｜Type｜Description',
    'App1｜Azure App Service app｜None',
    'Workspace1｜Log Analytics workspace｜Configured to use a pay-as-you-go pricing tier',
    'App1Logs｜Log Analytics table｜Hosted in Workspace1; Configured to use the Analytics Logs data plan',
  ],
  73: [
    'Name｜Type｜Performance',
    'storage1｜StorageV2｜Standard',
    'storage2｜StorageV2｜Premium',
    'storage3｜BlobStorage｜Standard',
    'storage4｜FileStorage｜Premium',
  ],
  79: [
    'Name｜Resource group｜Location｜Account kind',
    'storage1｜RG1｜East US｜StorageV2 (general purpose v2)',
    'storage2｜RG2｜Central US｜BlobStorage',
  ],
  80: [
    'On-premises source｜Azure target',
    'A Microsoft SQL Server 2012 database｜An Azure SQL database',
    'A table in a Microsoft SQL Server 2014 database｜An Azure Cosmos DB account that uses the SQL API',
  ],
  109: [
    'Policy 1 — Backup schedule｜Frequency Daily｜Time 6:00 PM｜Timezone (UTC) Coordinated Universal Time',
    'Instant Restore｜Retain instant recovery snapshot(s) for 3 Day(s)',
    'Retention of daily backup point｜selected｜At 6:00 PM｜For 90 Day(s)',
    'Retention of weekly backup point｜selected｜On Sunday｜At 6:00 PM｜For 26 Week(s)',
    'Retention of monthly backup point｜selected｜Week Based｜On First Sunday｜At 6:00 PM｜For 36 Month(s)',
    'Retention of yearly backup point｜not selected｜Not Configured',
  ],
  129: [
    'Name｜Location｜Azure AD tenant',
    'Sub1｜East US｜contoso.onmicrosoft.com',
    'Sub2｜East US｜contoso-recovery.onmicrosoft.com',
  ],
  168: [
    'Name｜Type｜Resource group',
    'VM1｜Azure virtual machine｜RG1',
    'VM2｜On-premises virtual machine｜Not applicable',
  ],
  170: [
    'Name｜Type｜Description',
    'VNET1｜Virtual network｜Connected to an on-premises network by using ExpressRoute',
    'VM1｜Virtual machine｜Configured as a DNS server',
    'SQLDB1｜Azure SQL Database｜Single instance',
    'PE1｜Private endpoint｜Provides connectivity to SQLDB1',
    'contoso.com｜Private DNS zone｜Linked to VNET1 and contains an A record for PE1',
    'contoso.com｜Public DNS zone｜Contains a C NAME record for SQLDB1',
  ],
  258: [
    'Name｜Type｜Description',
    'contoso.com｜Azure Private DNS zone｜None',
    'VNet1｜Virtual network｜Linked to contoso.com; Peered with VNet2',
    'VNet2｜Virtual network｜Linked to contoso.com; Peered with VNet1',
    'VNet3｜Virtual network｜Linked to contoso.com; Isolated from VNet1 and VNet2',
    'Workspace1｜Log Analytics workspace｜Stores logs collected from the virtual machines on all the virtual networks',
  ],
  262: LITWARE_SERVERS,
  270: LITWARE_SERVERS,
  // #271-#273's own copies of this bitmap are zero bytes in the source. Their
  // case-study introduction is byte-identical to #263/#270/#281, whose copies
  // were read directly, so the same exhibit applies.
  271: LITWARE_SERVERS,
  272: LITWARE_SERVERS,
  273: LITWARE_SERVERS,
  281: LITWARE_SERVERS,
  285: LITWARE_SERVERS,
  26: [
    'Name｜Type',
    'AS1｜Azure Synapse Analytics instance',
    'CDB1｜Azure Cosmos DB SQL API account',
  ],
  32: DIVISIONS,
  35: DIVISIONS,
  37: DIVISIONS,
  38: DIVISIONS,
  41: DIVISIONS,
  44: DIVISIONS,
  45: DIVISIONS,
  47: DIVISIONS,
  48: DIVISIONS,
  97: [
    'Name｜Type',
    'AS1｜Azure Synapse Analytics instance',
    'CDB1｜Azure Cosmos DB for NoSQL account',
  ],
  128: [
    'Name｜Type｜Description',
    'VNet1｜Virtual Network｜None',
    'LB1｜Public load balancer｜Includes a backend pool name BP1',
    'VMSS1｜Azure Virtual Machine Scale Sets｜Included in BP1; Connected to VNet1',
    'NVA1｜Network Virtual Appliance (NVA)｜Connected to VNet1; Performs security filtering of traffic for VMSS1',
    'NVA2｜Network Virtual Appliance (NVA)｜Connected to VNet1; Performs security filtering of traffic for VMSS1',
  ],
  135: [
    'Name｜Location',
    'Hub1｜US East',
    'Hub2｜US West',
  ],
  137: [
    'Location｜Resource',
    'Azure｜Azure subscription named Subscription1; 20 Azure web apps',
    'On-premises datacenter｜Active Directory domain; Server running Azure AD Connect; Linux computer named Server1',
  ],
  145: [
    'Name｜Type｜Location',
    'US-Central-Firewall-policy｜Azure Firewall policy｜Central US',
    'US-East-Firewall-policy｜Azure Firewall policy｜East US',
    'EU-Firewall-policy｜Azure Firewall policy｜West Europe',
    'USEastfirewall｜Azure Firewall｜Central US',
    'USWestfirewall｜Azure Firewall｜East US',
    'EUFirewall｜Azure Firewall｜West Europe',
  ],
  146: [
    'Name｜Size',
    'DB1｜400 GB',
    'DB2｜250 GB',
    'DB3｜300 GB',
    'DB4｜50 GB',
  ],
  163: [
    'Name｜Type｜Purpose',
    'App1｜App Service web app｜Processes customer orders',
    'Function1｜Function｜Checks product availability at vendor 1',
    'Function2｜Function｜Checks product availability at vendor 2',
    'storage2｜Storage account｜Stores order processing logs',
  ],
  210: DIVISIONS,
  212: [
    'Name｜Type｜Description',
    'VM1｜Virtual machine｜Frontend component in the Central US Azure region',
    'VM2｜Virtual machine｜Backend component in the East US Azure region',
    'VM3｜Virtual machine｜Backend component in the West US 2 Azure region',
    'VNet1｜Virtual network｜Hosts VM1',
    'VNet2｜Virtual network｜Hosts VM2',
    'VNet3｜Virtual network｜Hosts VM3',
  ],
  263: LITWARE_SERVERS,
}
