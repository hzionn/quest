// Answer keys for the AZ-305 HOTSPOT / DRAG DROP sections, transcribed from the
// widget bitmaps embedded in the source PDFs.
//
// Why this table is data and not parsed text: on these pages the candidate list
// is drawn in an /Image XObject. The write-up alongside it does describe the
// answer, but it cannot be trusted to reveal the *shape* of the widget — the
// recap paraphrases itself, and reading rows off it invents dropdowns that do
// not exist (#150's widget has two; its recap yields six "label: value" lines).
// So the widget is read directly, and the write-up is the cross-check.
//
// `kind` picks the record type:
//   * `matching` — one dropdown or drop target per labelled row. `rows` is
//     [label, chosen value]; `pool` is every candidate offered, distractors
//     included.
//   * `ordering` — the answer is a sequence. `rows` is the correct order.
//   * `multiple` — "which three features…", a set with no order. `pool` becomes
//     the lettered options and `rows` lists the chosen ones.
export const HOTSPOT = {
  5: {
    kind: 'matching',
    pool: ['Premium', 'Standard', 'Credential passthrough', 'Managed identities', 'MLflow', 'A runtime that contains Photon', 'Secret scope'],
    rows: [
      ['Databricks SKU', 'Premium'],
      ['Cluster configuration', 'Credential passthrough'],
    ],
  },
  10: {
    kind: 'matching',
    pool: ['AzureActivity', 'AzureDiagnostics', 'Event', 'Syslog'],
    rows: [
      ['Events from Windows event logs', 'Event'],
      ['Events from Linux system logging', 'Syslog'],
    ],
  },
  12: {
    // Stem asks "Which three features should you recommend?" — a set, not a
    // sequence, so this is graded order-insensitively.
    kind: 'multiple',
    pool: [
      'a public Azure Load Balancer',
      'a managed identity',
      'an internal Azure Load Balancer',
      'an Azure App Service plan',
      'Azure AD Application Proxy',
      'an Azure AD enterprise application',
      'a Conditional Access policy',
    ],
    rows: ['Azure AD Application Proxy', 'an Azure AD enterprise application', 'a Conditional Access policy'],
  },
  15: {
    // The答案 area is a pipeline (AD audit log → ▢ → ▢ → Cosmos DB), so which
    // slot each service goes in matters.
    kind: 'ordering',
    pool: ['Azure Event Grid', 'Azure Event Hubs', 'Azure Functions', 'Azure Monitor Logs', 'Azure Notification Hubs'],
    rows: ['Azure Event Hubs', 'Azure Functions'],
  },
  19: {
    kind: 'matching',
    pool: ['1', '2', '3', '4'],
    rows: [
      ['Management groups', '2'],
      ['Blueprint definitions', '2'],
      ['Blueprint assignments', '2'],
    ],
  },
  20: {
    kind: 'matching',
    pool: [
      'Append', 'EnforceOPAConstraint', 'EnforceRegoPolicy', 'Modify',
      'A managed identity with the Contributor role',
      'A managed identity with the User Access Administrator role',
      'A service principal with the Contributor role',
      'A service principal with the User Access Administrator role',
    ],
    rows: [
      ['Azure Policy effect to use', 'Modify'],
      ['Azure Active Directory (Azure AD) object and role-based access control (RBAC) role to use for the remediation tasks', 'A managed identity with the Contributor role'],
    ],
  },
  21: {
    kind: 'matching',
    pool: ['Yes', 'No'],
    rows: [
      ['You can add a new diagnostic setting that archives SQLInsights logs to storage2.', 'Yes'],
      ['You can add a new diagnostic setting that sends SQLInsights logs to Workspace2.', 'Yes'],
      ['You can add a new diagnostic setting that sends SQLInsights logs to Hub1.', 'Yes'],
    ],
  },
  24: {
    kind: 'matching',
    pool: [
      'Key Vault references in Application settings',
      'Key Vault references in Appsettings.json',
      'Key Vault references in Web.config',
      'Key Vault SDK',
      'Keys: Gey', 'Keys: List and Get', 'Secrets: Get', 'Secrets: List and Get',
    ],
    // The write-up says "Secrets: List and Get" here; the widget highlights
    // "Secrets: Get". The widget is the official key, so it wins.
    rows: [
      ['Key Vault integration method', 'Key Vault references in Application settings'],
      ['Key Vault permissions for the managed identity', 'Secrets: Get'],
    ],
  },
  29: {
    kind: 'matching',
    pool: [
      'Azure Bastion',
      'Just-in-time (JIT) VM access',
      'Azure Web Application Firewall (WAF) in Azure Front Door',
      'An Azure Identity Governance access package',
      'A Conditional Access policy that has the Cloud apps assignment set to Azure Windows VM Sign-In',
      'A Conditional Access policy that has the Cloud apps assignment set to Microsoft Azure Management',
    ],
    rows: [
      ['To provide access to virtual machines on VNET1, use', 'Azure Bastion'],
      ['To enforce Azure MFA, use', 'A Conditional Access policy that has the Cloud apps assignment set to Azure Windows VM Sign-In'],
    ],
  },
  40: {
    kind: 'matching',
    pool: [
      'Authorization code grant flows', 'Client credentials grant flows', 'Implicit grant flows',
      'Azure Instance Metadata Service (IMDS) endpoint',
      'OAuth 2.0 access token endpoint of Azure AD',
      'OAuth 2.0 access token endpoint of Microsoft Identity Platform',
    ],
    rows: [
      ['Configure App1 to use OAuth 2.0', 'Client credentials grant flows'],
      ['Configure App1 to use a REST API call to retrieve an authentication token from the', 'Azure Instance Metadata Service (IMDS) endpoint'],
    ],
  },
  46: {
    kind: 'matching',
    pool: ['Yes', 'No'],
    rows: [
      ['User1 can create a new virtual machine in RG1.', 'Yes'],
      ['User2 can grant permissions to Group2.', 'No'],
      ['User3 can create a storage account in RG2.', 'Yes'],
    ],
  },
  52: {
    kind: 'matching',
    pool: [
      'Helpdesk Administrator for MarketingAU',
      'Helpdesk Administrator for the tenant',
      'User Administrator for MarketingAU',
      'User Administrator for the tenant',
    ],
    rows: [
      ['User1', 'User Administrator for MarketingAU'],
      ['User2', 'Helpdesk Administrator for MarketingAU'],
    ],
  },
  55: {
    kind: 'matching',
    pool: ['API permissions', 'App roles', 'Token configuration'],
    rows: [
      ['App1', 'App roles'],
      ['App2', 'API permissions'],
    ],
  },
  61: {
    kind: 'matching',
    pool: [
      'DeployIfNotExists', 'EnforceRegoPolicy', 'Modify',
      'The identity required to perform the remediation task',
      'The scopes of the policy assignments',
      'The role-based access control (RBAC) roles required to perform the remediation task',
    ],
    rows: [
      ['Set available effects to', 'DeployIfNotExists'],
      ['Include in the definition', 'The role-based access control (RBAC) roles required to perform the remediation task'],
    ],
  },
  63: {
    kind: 'matching',
    pool: [
      'App1', 'App1Logs', 'Workspace1',
      'Change to a commitment pricing tier',
      'Change to the Basic Logs data plan.',
      'Set a daily cap.',
    ],
    rows: [
      ['Resource', 'Workspace1'],
      ['Modification', 'Change to a commitment pricing tier'],
    ],
  },
  67: {
    kind: 'matching',
    pool: [
      'Azure Event Grid', 'Azure Lighthouse', 'Azure Purview',
      'The Log Analytics agent', 'The Azure Monitor agent', 'The Azure Connected Machine agent',
    ],
    rows: [
      ['To collect the event logs', 'Azure Lighthouse'],
      ['To support the DCRs', 'The Azure Monitor agent'],
    ],
  },
  59: {
    kind: 'matching',
    pool: ['0', '1', '2', '3', '4'],
    rows: [
      ['Minimum number of Azure AD tenants', '1'],
      ['Minimum number of conditional access policies to create', '2'],
    ],
  },
  72: {
    kind: 'matching',
    pool: [
      'BlobStorage', 'BlockBlobStorage', 'FileStorage',
      'StorageV2 with Premium performance', 'StorageV2 with Standard performance',
      'Blob', 'File', 'Table',
    ],
    rows: [
      ['Storage account type', 'BlockBlobStorage'],
      ['Storage service', 'Blob'],
    ],
  },
  73: {
    kind: 'matching',
    pool: [
      'Storage1 and storage2 only',
      'Storage1 and storage3 only',
      'Storage1, storage2, and storage3 only',
      'Storage1, storage2, storage3, and storage4',
      'Storage4 only',
      'Storage1 and storage4 only',
      'Storage1, storage2, and storage4 only',
    ],
    rows: [
      ['App1', 'Storage1 and storage3 only'],
      ['App2', 'Storage1 and storage4 only'],
    ],
  },
  76: {
    kind: 'matching',
    pool: [
      'Azure SQL Database', 'Azure SQL Managed Instance', 'Azure Synapse Analytics',
      'SQL Server on Azure Virtual Machines',
      'Basic', 'Business Critical', 'General Purpose', 'Hyperscale', 'Premium', 'Standard',
    ],
    rows: [
      ['Service', 'Azure SQL Database'],
      ['Service tier', 'Hyperscale'],
    ],
  },
  79: {
    kind: 'matching',
    pool: ['Yes', 'No'],
    rows: [
      ['When you enable auditing for SQLdb1, you can store the audit information to storage1.', 'Yes'],
      ['When you enable auditing for SQLdb2, you can store the audit information to storage2.', 'No'],
      ['When you enable auditing for SQLdb3, you can store the audit information to storage2.', 'No'],
    ],
  },
  80: {
    kind: 'matching',
    pool: ['AzCopy', 'Azure Cosmos DB Data Migration Tool', 'Data Management Gateway', 'Data Migration Assistant'],
    rows: [
      ['From the SQL Server 2012 database', 'Data Migration Assistant'],
      ['From the table in the SQL Server 2014 database', 'Azure Cosmos DB Data Migration Tool'],
    ],
  },
  85: {
    kind: 'matching',
    pool: [
      'General purpose v2 with Archive access tier for blobs',
      'General purpose v2 with Cool access tier for blobs',
      'General purpose v2 with Hot access tier for blobs',
      'Container access level', 'Container access policy', 'Storage account resource lock',
    ],
    rows: [
      ['Storage account type', 'General purpose v2 with Hot access tier for blobs'],
      ['Configuration to prevent modifications and deletions', 'Container access policy'],
    ],
  },
  86: {
    kind: 'matching',
    pool: [
      'Azure Blob Storage', 'Azure Data Lake Storage Gen2', 'Azure Files', 'Azure NetApp Files',
      'Azure Cosmos DB Cassandra API', 'Azure Cosmos DB SQL API',
      'Azure SQL Database Hyperscale', 'Azure Synapse Analytics dedicated SQL pools',
    ],
    rows: [
      ['Data store for the ingested data', 'Azure Data Lake Storage Gen2'],
      ['Data store for the data warehouse', 'Azure SQL Database Hyperscale'],
    ],
  },
  102: {
    kind: 'matching',
    pool: [
      'Append', 'Block', 'Page',
      'A stored access policy', 'Immutable blob storage', 'Object replication', 'The change feed',
    ],
    rows: [
      ['Blob type', 'Block'],
      ['Enable', 'The change feed'],
    ],
  },
  105: {
    kind: 'matching',
    pool: [
      'A single Azure SQL database', 'An Azure SQL Database elastic pool', 'Azure SQL Managed Instances',
      'Business Critical', 'Hyperscale', 'Premium',
    ],
    rows: [
      ['Service', 'A single Azure SQL database'],
      ['Service tier', 'Hyperscale'],
    ],
  },
  112: {
    kind: 'matching',
    pool: [
      'Hot', 'Premium', 'Transaction optimized',
      'Geo-redundant storage (GRS)', 'Zone-redundant storage (ZRS)', 'Locally-redundant storage (LRS)',
    ],
    rows: [
      ['Storage tier', 'Premium'],
      ['Redundancy', 'Zone-redundant storage (ZRS)'],
    ],
  },
  115: {
    kind: 'matching',
    pool: [
      'Premium block blobs', 'Standard general-purpose v1', 'Standard general-purpose v2',
      'Zone-redundant storage (ZRS)', 'Locally-redundant storage (LRS)',
    ],
    rows: [
      ['Storage Account type', 'Premium block blobs'],
      ['Redundancy', 'Zone-redundant storage (ZRS)'],
    ],
  },
  118: {
    kind: 'matching',
    pool: [
      'A server in the same availability set', 'A server in the same fault domain',
      'A server in the paired region', 'A virtual machine in a scale set',
      'Get', 'List', 'Wrap', 'Delete', 'Unwrap', 'Backup', 'Decrypt', 'Encrypt',
    ],
    rows: [
      ['To where will KV1 fail over?', 'A server in the paired region'],
      ['During the failover, which request type will be unavailable?', 'Delete'],
    ],
  },
  119: {
    kind: 'matching',
    pool: ['Azure Backup only', 'Azure Site Recovery and Azure Backup', 'Azure Site Recovery only'],
    rows: [
      ['Sales', 'Azure Site Recovery only'],
      ['Finance', 'Azure Site Recovery and Azure Backup'],
      ['Reporting', 'Azure Backup only'],
    ],
  },
  109: {
    kind: 'matching',
    pool: ['90 days', '26 weeks', '36 months', '45 months', '1 hour', '1 day', '1 week', '1 month', '1 year'],
    rows: [
      ['Virtual machines that are backed up by using the policy can be recovered for up to a maximum of [answer choice]', '36 months'],
      ['The minimum recovery point objective (RPO) for virtual machines that are backed up by using the policy is [answer choice]', '1 day'],
    ],
  },
  124: {
    kind: 'matching',
    pool: [
      'Azure SQL Database', 'Azure SQL managed Instance', 'The Hyperscale service tier',
      'Active geo-replication', 'Auto-failover groups', 'Standard geo-replication',
    ],
    rows: [
      ['Azure service or service tier', 'The Hyperscale service tier'],
      ['Replication mechanism', 'Active geo-replication'],
    ],
  },
  126: {
    kind: 'matching',
    pool: [
      'Business Critical service tier and Serverless computer tier',
      'General Purpose service tier and Serverless computer tier',
      'Hyperscale service tier and Provisioned compute tier',
      'Always Encrypted',
      'Microsoft SQL Server and database encryption keys',
      'Transparent Data Encryption (TDE)',
    ],
    rows: [
      ['Service tier and computer tier', 'General Purpose service tier and Serverless computer tier'],
      ['Encryption method', 'Always Encrypted'],
    ],
  },
  130: {
    kind: 'matching',
    pool: [
      'The Azure Site Recovery Mobility service',
      'The Microsoft Azure Recovery Services (MARS) agent',
      'Volume Shadow Copy Service (VSS)',
      'Geo-redundant storage (GRS)', 'Locally-redundant storage (LRS)', 'Zone-redundant storage (ZRS)',
    ],
    rows: [
      ['On the servers', 'The Microsoft Azure Recovery Services (MARS) agent'],
      ['For the storage', 'Locally-redundant storage (LRS)'],
    ],
  },
  141: {
    kind: 'matching',
    pool: ['Yes', 'No'],
    rows: [
      ['The API is available to partners over the internet.', 'Yes'],
      ['The APIM instance can access real-time data from VM1.', 'Yes'],
      ['A VPN gateway is required for partner access.', 'No'],
    ],
  },
  142: {
    kind: 'matching',
    pool: [
      'Web Application Firewall (WAF)', 'Azure Application Gateway', 'Azure Load Balancer',
      'Azure Traffic Manager', 'SSL offloading', 'URL-based content routing',
    ],
    rows: [
      ['Azure service', 'Azure Application Gateway'],
      ['Feature', 'Web Application Firewall (WAF)'],
    ],
  },
  155: {
    kind: 'matching',
    pool: [
      'Premium files shares', 'Premium page blobs', 'Standard general-purpose v2',
      'Zone-redundant storage (ZRS)', 'Locally-redundant storage (LRS)', 'Geo-redundant storage (GRS)',
      'Azure Route Server', 'A private endpoint', 'A service endpoint',
    ],
    rows: [
      ['Storage account type', 'Standard general-purpose v2'],
      ['Data redundancy', 'Geo-redundant storage (GRS)'],
      ['Networking', 'A private endpoint'],
    ],
  },
  158: {
    kind: 'matching',
    pool: ['172.16.0.0/16', '172.16.1.0/27', '192.168.0.0/24', '192.168.1.0/27'],
    rows: [
      ['Subnet1', '192.168.0.0/24'],
      ['Gateway subnet', '192.168.1.0/27'],
    ],
  },
  170: {
    kind: 'matching',
    pool: [
      'Configure VM1 to forward contoso.com to the public DNS zone',
      'Configure VM1 to forward contoso.com to the Azure-provided DNS at 168.63.129.16',
      'In VNet1, configure a custom DNS server set to the Azure provided DNS at 168.63.129.16',
      'Forward contoso.com to VM1',
      'Forward contoso.com to the public DNS zone',
      'Forward contoso.com to the Azure-provisioned DNS at 168.63.129.16',
    ],
    rows: [
      ['Azure configuration', 'Configure VM1 to forward contoso.com to the Azure-provided DNS at 168.63.129.16'],
      ['On-premises DNS configuration', 'Forward contoso.com to VM1'],
    ],
  },
  182: {
    kind: 'matching',
    pool: ['None', 'ReadOnly', 'ReadWrite'],
    rows: [
      ['Log', 'None'],
      ['Data', 'ReadOnly'],
    ],
  },
  185: {
    kind: 'matching',
    pool: [
      'Azure SQL Managed Instance', 'SQL Server on Azure Virtual Machines',
      'An Azure SQL Database single database',
      'Auto-failover group', 'Active geo-replication', 'Zone-redundant deployment',
    ],
    rows: [
      ['Deployment solution', 'Azure SQL Managed Instance'],
      ['Resiliency solution', 'Auto-failover group'],
    ],
  },
  196: {
    kind: 'matching',
    pool: [
      'DTU', 'vCore', 'Azure reserved virtual machine instances',
      'An Azure SQL managed instance', 'An Azure SQL Database elastic pool',
      'A SQL Server Always On availability group',
    ],
    rows: [
      ['Purchase model', 'vCore'],
      ['Deployment option', 'An Azure SQL Database elastic pool'],
    ],
  },
  214: {
    kind: 'matching',
    pool: ['DS', 'NC', 'NV', 'Standard SSD', 'Premium SSD', 'Ultra Disk'],
    rows: [
      ['Virtual machine series', 'DS'],
      ['Disk type', 'Premium SSD'],
    ],
  },
  220: {
    kind: 'matching',
    pool: ['1', '2', '3', '4', 'Basic', 'Standard'],
    rows: [
      ['Number of Virtual WAN hubs', '3'],
      ['Virtual WAN SKU', 'Standard'],
    ],
  },
  236: {
    kind: 'matching',
    pool: ['1', '2', '3', '4', 'A-Series', 'B-Series', 'D-Series', 'M-Series'],
    rows: [
      ['Number of virtual networks', '2'],
      ['Virtual machine size', 'B-Series'],
    ],
  },
  242: {
    kind: 'matching',
    pool: [
      'Protection against Open Web Application Security Project (OWASP) vulnerabilities',
      'IP filtering on a per-API level',
      'Validation of Azure B2C JSON Web Tokens (JWTs)',
    ],
    rows: [
      ['Front Door', 'Protection against Open Web Application Security Project (OWASP) vulnerabilities'],
      ['API Management', 'Validation of Azure B2C JSON Web Tokens (JWTs)'],
    ],
  },
  140: {
    kind: 'matching',
    pool: [
      'A Web Application Proxy for Windows Server', 'An Azure AD Application Proxy connector',
      'An On-premises data gateway', 'Hybrid Connection Manager',
      'A connection gateway resource', 'An Azure Application Gateway',
      'An Azure Event Grid domain', 'An enterprise application',
    ],
    rows: [
      ['On-premises', 'An On-premises data gateway'],
      ['Azure', 'A connection gateway resource'],
    ],
  },
  246: {
    kind: 'matching',
    pool: [
      'A managed identity', 'An access package', 'An app registration', 'An enterprise application',
      'A server that runs Windows Server and has the Azure AD Application Proxy connector installed',
      'A server that runs Windows Server and has the on-premises data gateway (standard mode) installed',
      'A server that runs Windows Server and has the Web Application Proxy role service installed',
    ],
    rows: [
      ['In Azure AD', 'An enterprise application'],
      ['On-premises', 'A server that runs Windows Server and has the Azure AD Application Proxy connector installed'],
    ],
  },
  248: {
    kind: 'matching',
    pool: [
      'Configure a dedicated managed virtual network',
      'Disable public network access to the workspace endpoints.',
      'Enable the use of the Azure AD authentication.',
      'Managed private endpoints', 'Server-level firewall rules', 'Service endpoint policies',
    ],
    rows: [
      ['When provisioning the Azure Synapse workspace', 'Configure a dedicated managed virtual network'],
      ['When configuring the Azure Cosmos DB account, enable', 'Managed private endpoints'],
    ],
  },
  250: {
    kind: 'matching',
    pool: [
      'An Azure Migrate appliance', 'An Azure Migrate project',
      'An Azure VMware Solution private cloud', 'An Azure VMware Solution host',
    ],
    rows: [
      ['Sub1', 'An Azure Migrate project'],
      ['Cluster1', 'An Azure Migrate appliance'],
    ],
  },
  65: {
    kind: 'matching',
    pool: [
      'An Azure template', 'The Azure Command-Line Interface (CLI)', 'The Azure portal',
      'Azure activity logs', 'Log Analytics workspace', 'Storage accounts',
    ],
    rows: [
      ['To trigger the compliance scans, use', 'The Azure Command-Line Interface (CLI)'],
      ['To generate the non-compliance alerts, configure diagnostic settings for the', 'Azure activity logs'],
    ],
  },
  114: {
    kind: 'matching',
    pool: [
      'BlobStorage with Standard performance, Hot access tier, and Read-access geo-redundant storage (RA-GRS) replication',
      'BlockBlobStorage with Premium performance and Zone-redundant storage (ZRS) replication',
      'General purpose v1 with Premium performance and Locally-redundant storage (LRS) replication',
      'General purpose v2 with Standard performance, Hot access tier, and Locally-redundant storage (LRS) replication',
      'BlobStorage with Standard performance, Cool access tier, and Geo-redundant storage (GRS) replication',
      'General purpose v1 with Standard performance and Read-access geo-redundant storage (RA-GRS) replication',
      'General purpose v2 with Standard performance, Cool access tier, and Read-access geo-redundant storage (RA-GRS) replication',
    ],
    rows: [
      ['Application1', 'BlockBlobStorage with Premium performance and Zone-redundant storage (ZRS) replication'],
      ['Application2', 'General purpose v2 with Standard performance, Cool access tier, and Read-access geo-redundant storage (RA-GRS) replication'],
    ],
  },
  132: {
    // Stem: "Which two settings should you enable?". The write-up's recap names
    // only one setting, and a different one at that; the widget marks the two
    // that the exam scores, so the widget wins.
    kind: 'multiple',
    pool: [
      'Enable operational backup with Azure Backup',
      'Enable point-in-time restore for containers',
      'Enable soft delete for blobs',
      'Enable soft delete for containers',
      'Enable permanent delete for soft deleted items',
      'Enable versioning for blobs',
      'Enable blob change feed',
      'Enable version-level immutability support',
    ],
    rows: ['Enable operational backup with Azure Backup', 'Enable permanent delete for soft deleted items'],
  },
  134: {
    kind: 'ordering',
    pool: [
      'After a failover, configure geo-redundant storage (GRS) replication for the storage account.',
      'Initiate a failover.',
      'Before a failover, configure zone-redundant storage (ZRS) replication for the storage account.',
      'Before a failover, configure geo-redundant storage (GRS) replication for the storage account.',
      'After a failover, configure zone-redundant storage (ZRS) replication for the storage account.',
    ],
    rows: [
      'Before a failover, configure geo-redundant storage (GRS) replication for the storage account.',
      'Initiate a failover.',
      'After a failover, configure geo-redundant storage (GRS) replication for the storage account.',
    ],
  },
  270: {
    kind: 'matching',
    pool: ['1', '2', '3', '6', '0'],
    rows: [
      ['Number of host groups', '3'],
      ['Number of virtual machine scale sets', '3'],
    ],
  },
  275: {
    kind: 'matching',
    pool: ['0', '1', '2', '3', '4'],
    rows: [
      ['Minimum number of Azure AD tenants', '1'],
      ['Minimum number of custom domains to add', '1'],
      ['Minimum number of conditional access policies to create', '2'],
    ],
  },
  282: {
    kind: 'matching',
    pool: [
      'Azure Blob Storage', 'Azure Data Box', 'Azure Data Box Gateway',
      'Azure Data Lake Storage', 'Azure File Sync', 'Azure Files',
    ],
    rows: [
      ['Azure subscription', 'Azure Files'],
      ['On-premises network', 'Azure File Sync'],
    ],
  },
  284: {
    kind: 'matching',
    pool: ['1', '2', '3', '6'],
    rows: [
      ['Azure Traffic Manager', '1'],
      ['Azure Application Gateway', '2'],
    ],
  },
  286: {
    kind: 'matching',
    pool: ['Yes', 'No'],
    rows: [
      ['The design supports the technical requirements for redundancy.', 'Yes'],
      ['The design supports autoscaling.', 'No'],
      ['The design requires a manual configuration if an Azure region fails.', 'No'],
    ],
  },
  251: {
    kind: 'matching',
    pool: [
      'Azure SQL Database', 'Azure SQL Managed Instance', 'SQL Server on Azure Virtual Machines',
      'Azure Database Migration Service', 'Azure Migrate',
      'The Azure SQL Migration extension for Azure Data Studio',
    ],
    rows: [
      ['Migrate to', 'SQL Server on Azure Virtual Machines'],
      ['By using', 'Azure Migrate'],
    ],
  },
  268: {
    kind: 'matching',
    pool: ['Yes', 'No'],
    rows: [
      ['You must provision an Azure Storage account for the SQL Server database migration.', 'No'],
      ['You must provision an Azure Storage account for the Web site content storage.', 'No'],
      ['You must provision an Azure Storage account for the Database metric monitoring.', 'No'],
    ],
  },
  271: {
    kind: 'matching',
    pool: [
      'Premium page blobs', 'Premium file shares', 'Standard general-purpose v2',
      'NFSv3', 'Large file shares', 'Hierarchical namespace',
    ],
    rows: [
      ['Storage account type', 'Standard general-purpose v2'],
      ['Configuration', 'Hierarchical namespace'],
    ],
  },
  285: {
    kind: 'matching',
    pool: [
      'A single Azure SQL database', 'Azure SQL Managed Instance',
      'An Azure SQL Database elastic pool',
      'Hyperscale', 'Business Critical', 'General Purpose',
    ],
    rows: [
      ['Database', 'Azure SQL Managed Instance'],
      ['Service tier', 'Business Critical'],
    ],
  },
  262: {
    kind: 'matching',
    pool: [
      'Azure AD Identity Protection', 'Security defaults in Azure AD',
      'Azure AD authentication methods policy',
      'Grant control in capolicy1', 'Session control in capolicy1',
      'Sign-in risk policy in Azure AD Identity Protection for the Litware.com.tenant',
    ],
    rows: [
      ['To register the users for Azure MFA, use', 'Azure AD Identity Protection'],
      ['To enforce Azure MFA authentication, configure', 'Grant control in capolicy1'],
    ],
  },
  267: {
    // The write-up has no official-answer section for this one; the widget does,
    // and it is the only source for the key here.
    kind: 'matching',
    pool: [
      'A certificate', 'A system-assigned managed identity', 'A user-assigned managed identity',
      'An access policy', 'A connected service', 'A private link', 'A role assignment',
    ],
    rows: [
      ['Authenticate App1 by using', 'A system-assigned managed identity'],
      ['Authorize App1 to retrieve Key Vault secrets by using', 'A role assignment'],
    ],
  },
  281: {
    kind: 'matching',
    pool: [
      'A single Azure SQL database', 'Azure SQL Managed Instance',
      'An Azure SQL Database elastic pool',
      'Hyperscale', 'Business Critical', 'General Purpose',
    ],
    rows: [
      ['Database', 'An Azure SQL Database elastic pool'],
      ['Service tier', 'Business Critical'],
    ],
  },
}
