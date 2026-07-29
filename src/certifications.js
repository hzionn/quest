export const CERTIFICATIONS = [
  { id: 'aws-clf', provider: 'AWS', name: 'AWS Certified Cloud Practitioner', exams: ['CLF-C02'], badge: 'cert-badges/clf.png' },
  { id: 'aws-saa', provider: 'AWS', name: 'AWS Certified Solutions Architect – Associate', exams: ['SAA-C03'], badge: 'cert-badges/saa.png' },
  { id: 'aws-scs', provider: 'AWS', name: 'AWS Certified Security – Specialty', exams: ['SCS-C02', 'SCS-C03', 'SCS-C03 補充'], badge: 'cert-badges/scs.png' },
  { id: 'aws-soa', provider: 'AWS', name: 'AWS Certified CloudOps Engineer – Associate', exams: ['SOA-C02', 'SOA-C03'], badge: 'cert-badges/soa.png' },
  { id: 'aws-dea', provider: 'AWS', name: 'AWS Certified Data Engineer – Associate', exams: ['DEA-C01'], badge: 'cert-badges/dea.png' },
  { id: 'aws-mla', provider: 'AWS', name: 'AWS Certified Machine Learning Engineer – Associate', exams: ['MLA-C01'], badge: 'cert-badges/mla.png' },
  { id: 'aws-aip', provider: 'AWS', name: 'AWS Certified Generative AI Developer – Professional', exams: ['AIP-C01'], badge: 'cert-badges/aip.png' },
  { id: 'gcp-pca', provider: 'GCP', name: 'Google Cloud Professional Cloud Architect', exams: ['PCA'], badge: 'gcp-logo.png' },
  { id: 'gcp-cdl', provider: 'GCP', name: 'Google Cloud Digital Leader', exams: ['GCP-CDL'], badge: 'gcp-logo.png' },
  { id: 'azure-az104', provider: 'Azure', name: 'Microsoft Certified: Azure Administrator Associate', exams: ['AZ-104'], badge: 'azure-logo.png' },
]

export function isCertificationEarned(entry) {
  return !!entry?.enabled
}

export function getExcludedExams(earnedCertifications = {}) {
  const excluded = new Set()
  for (const cert of CERTIFICATIONS) {
    if (!isCertificationEarned(earnedCertifications[cert.id])) continue
    cert.exams.forEach(exam => excluded.add(exam))
  }
  return excluded
}
