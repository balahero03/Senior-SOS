// backend/prisma/seed-data/reference.js
// Vocabulary used to build coherent profiles and post content: which skills,
// companies and job titles plausibly go together for each department.

'use strict';

const DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science and Engineering' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'ECE', name: 'Electronics and Communication Engineering' },
  { code: 'EEE', name: 'Electrical and Electronics Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'CIVIL', name: 'Civil Engineering' },
  { code: 'BME', name: 'Biomedical Engineering' },
  { code: 'CHEM', name: 'Chemical Engineering' },
];

// Department → skills that actually belong to that discipline.
const DEPT_SKILLS = {
  CSE: ['Data Structures', 'Algorithms', 'System Design', 'Java', 'Python', 'C++', 'React',
    'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'Distributed Systems',
    'Machine Learning', 'Competitive Programming', 'Operating Systems', 'Computer Networks',
    'TypeScript', 'Go', 'Kafka', 'Redis', 'MongoDB', 'GraphQL', 'Linux'],
  IT: ['React', 'Node.js', 'TypeScript', 'JavaScript', 'Next.js', 'MongoDB', 'PostgreSQL',
    'REST APIs', 'GraphQL', 'Docker', 'AWS', 'CI/CD', 'UI/UX Design', 'Figma',
    'Python', 'Django', 'FastAPI', 'SQL', 'Data Analysis', 'System Design'],
  ECE: ['Embedded Systems', 'VLSI', 'Verilog', 'C', 'C++', 'MATLAB', 'IoT',
    'Signal Processing', 'PCB Design', 'Python', 'Computer Networks', 'Linux'],
  EEE: ['Power Electronics', 'Control Systems', 'MATLAB', 'Embedded Systems', 'IoT',
    'PCB Design', 'C', 'Python', 'Signal Processing'],
  MECH: ['AutoCAD', 'SolidWorks', 'CATIA', 'Thermodynamics', 'Finite Element Analysis',
    'MATLAB', 'Project Management', 'Python'],
  CIVIL: ['AutoCAD', 'Structural Analysis', 'Construction Management', 'Project Management',
    'SolidWorks', 'MATLAB'],
  BME: ['Biomedical Instrumentation', 'Medical Image Processing', 'MATLAB', 'Python',
    'Machine Learning', 'Signal Processing', 'Embedded Systems'],
  CHEM: ['Process Simulation', 'MATLAB', 'Thermodynamics', 'Data Analysis', 'Python',
    'Project Management'],
};

const DEPT_TRACK = {
  CSE: 'software', IT: 'software', ECE: 'hardware', EEE: 'hardware',
  MECH: 'core', CIVIL: 'core', BME: 'core', CHEM: 'core',
};

// Job titles with the experience band each one realistically sits in.
const DESIGNATIONS = {
  software: [
    { title: 'Associate Software Engineer', min: 0.5, max: 2 },
    { title: 'Software Engineer', min: 1, max: 4 },
    { title: 'Software Engineer II', min: 2, max: 5 },
    { title: 'Senior Software Engineer', min: 4, max: 8 },
    { title: 'Staff Software Engineer', min: 7, max: 12 },
    { title: 'Engineering Manager', min: 8, max: 14 },
    { title: 'Backend Engineer', min: 1, max: 6 },
    { title: 'Frontend Engineer', min: 1, max: 6 },
    { title: 'Full Stack Engineer', min: 1, max: 6 },
    { title: 'Site Reliability Engineer', min: 2, max: 7 },
    { title: 'Data Engineer', min: 2, max: 7 },
    { title: 'Machine Learning Engineer', min: 2, max: 7 },
    { title: 'Data Scientist', min: 2, max: 7 },
    { title: 'DevOps Engineer', min: 2, max: 7 },
    { title: 'Mobile Engineer', min: 1, max: 5 },
    { title: 'Product Manager', min: 3, max: 9 },
    { title: 'Technical Lead', min: 5, max: 10 },
  ],
  hardware: [
    { title: 'Hardware Engineer', min: 1, max: 5 },
    { title: 'Embedded Systems Engineer', min: 1, max: 6 },
    { title: 'VLSI Design Engineer', min: 1, max: 6 },
    { title: 'Firmware Engineer', min: 1, max: 5 },
    { title: 'Senior Hardware Engineer', min: 4, max: 9 },
    { title: 'Validation Engineer', min: 1, max: 5 },
    { title: 'RF Engineer', min: 1, max: 6 },
  ],
  core: [
    { title: 'Design Engineer', min: 1, max: 5 },
    { title: 'Project Engineer', min: 1, max: 6 },
    { title: 'Graduate Engineer Trainee', min: 0, max: 1.5 },
    { title: 'Senior Design Engineer', min: 4, max: 9 },
    { title: 'Process Engineer', min: 1, max: 6 },
    { title: 'Structural Engineer', min: 1, max: 6 },
    { title: 'Manufacturing Engineer', min: 1, max: 6 },
  ],
};

// Companies that realistically hire each track.
const TRACK_COMPANIES = {
  software: ['Google', 'Microsoft', 'Amazon', 'Zoho', 'Flipkart', 'Swiggy', 'Zomato',
    'Razorpay', 'CRED', 'PhonePe', 'Freshworks', 'Postman', 'Atlassian', 'Adobe',
    'Salesforce', 'Oracle', 'VMware', 'Intuit', 'Walmart Global Tech', 'PayPal',
    'Uber', 'Netflix', 'TCS', 'Infosys', 'Wipro', 'Accenture', 'Thoughtworks',
    'Juspay', 'Hasura', 'Chargebee'],
  hardware: ['Qualcomm', 'Cisco', 'Nvidia', 'Intel', 'Texas Instruments', 'Bosch',
    'Ather Energy', 'Ola Electric', 'L&T Technology Services'],
  core: ['Ashok Leyland', 'L&T Technology Services', 'Bosch', 'Zetwerk', 'TCS',
    'Deloitte', 'Ather Energy', 'Ola Electric'],
};

// What each company is actually known for — used so posts reference real work.
const COMPANY_CONTEXT = {
  Google: { domain: 'search and distributed infrastructure', scale: 'billions of queries a day' },
  Microsoft: { domain: 'cloud and developer tooling', scale: 'enterprise customers worldwide' },
  Amazon: { domain: 'e-commerce and AWS infrastructure', scale: 'peak traffic during sale events' },
  Zoho: { domain: 'business SaaS products', scale: 'a large self-hosted product suite' },
  Flipkart: { domain: 'e-commerce at Indian scale', scale: 'Big Billion Days traffic' },
  Swiggy: { domain: 'food delivery logistics', scale: 'lunch and dinner peak loads' },
  Zomato: { domain: 'restaurant discovery and delivery', scale: 'millions of daily orders' },
  Razorpay: { domain: 'payments infrastructure', scale: 'high-volume transaction flows' },
  CRED: { domain: 'fintech and credit products', scale: 'a very latency-sensitive product' },
  PhonePe: { domain: 'UPI payments', scale: 'billions of monthly transactions' },
  Freshworks: { domain: 'customer engagement SaaS', scale: 'multi-tenant architecture' },
  Postman: { domain: 'API developer tooling', scale: 'millions of developers' },
  Atlassian: { domain: 'team collaboration tools', scale: 'large enterprise deployments' },
  Adobe: { domain: 'creative and document software', scale: 'a huge desktop and cloud userbase' },
  Salesforce: { domain: 'enterprise CRM', scale: 'heavily customised tenant deployments' },
  Oracle: { domain: 'databases and enterprise cloud', scale: 'mission-critical workloads' },
  VMware: { domain: 'virtualisation and infrastructure', scale: 'data-centre scale systems' },
  Intuit: { domain: 'fintech and tax software', scale: 'extreme seasonal traffic spikes' },
  'Walmart Global Tech': { domain: 'retail supply chain systems', scale: 'global store operations' },
  PayPal: { domain: 'global payments', scale: 'cross-border transaction volume' },
  Uber: { domain: 'real-time marketplace and mapping', scale: 'live trip matching' },
  Netflix: { domain: 'video streaming infrastructure', scale: 'global content delivery' },
  Nvidia: { domain: 'GPUs and accelerated computing', scale: 'AI training hardware' },
  Intel: { domain: 'processor design and fabrication', scale: 'silicon at huge volume' },
  'Texas Instruments': { domain: 'analog and embedded chips', scale: 'industrial and automotive parts' },
  Qualcomm: { domain: 'mobile chipsets and modems', scale: 'most of the phones you have held' },
  Cisco: { domain: 'networking hardware and software', scale: 'internet backbone equipment' },
  Bosch: { domain: 'automotive and industrial engineering', scale: 'global manufacturing' },
  'Ather Energy': { domain: 'electric two-wheelers', scale: 'a fast-growing EV fleet' },
  'Ola Electric': { domain: 'EV manufacturing', scale: 'large-scale vehicle production' },
  'L&T Technology Services': { domain: 'engineering R&D services', scale: 'multiple client programmes' },
  TCS: { domain: 'large-scale IT services', scale: 'global client delivery' },
  Infosys: { domain: 'IT consulting and services', scale: 'enterprise transformation projects' },
  Wipro: { domain: 'IT services and consulting', scale: 'global delivery centres' },
  Accenture: { domain: 'technology consulting', scale: 'cross-industry client work' },
  Deloitte: { domain: 'consulting and advisory', scale: 'enterprise engagements' },
  Thoughtworks: { domain: 'custom software consulting', scale: 'product teams across clients' },
  Juspay: { domain: 'payment orchestration', scale: 'high-throughput payment routing' },
  Hasura: { domain: 'GraphQL data APIs', scale: 'developer-facing infrastructure' },
  Chargebee: { domain: 'subscription billing', scale: 'recurring revenue systems' },
  Zetwerk: { domain: 'manufacturing marketplaces', scale: 'distributed supplier networks' },
  'Ashok Leyland': { domain: 'commercial vehicle manufacturing', scale: 'heavy vehicle production lines' },
};

const FOCUS_AREAS = [
  'Backend Development', 'Frontend Development', 'System Design',
  'Placement Preparation', 'Career Guidance', 'Higher Studies',
  'Entrepreneurship', 'Machine Learning', 'Competitive Programming',
  'Resume Review', 'Interview Preparation', 'Cloud and DevOps',
  'Product Management', 'Embedded Systems', 'Core Engineering Roles',
];

// Focus areas that make sense for each department. Without this a CIVIL
// student ends up posting about frontend development, which reads as fake.
// The universal ones (placements, resumes, higher studies) apply everywhere.
const UNIVERSAL_FOCUS = [
  'Placement Preparation', 'Career Guidance', 'Higher Studies',
  'Resume Review', 'Interview Preparation', 'Entrepreneurship',
];

const DEPT_FOCUS = {
  CSE: ['Backend Development', 'Frontend Development', 'System Design',
    'Machine Learning', 'Competitive Programming', 'Cloud and DevOps',
    'Product Management'],
  IT: ['Frontend Development', 'Backend Development', 'System Design',
    'Cloud and DevOps', 'Product Management'],
  ECE: ['Embedded Systems', 'Core Engineering Roles', 'System Design'],
  EEE: ['Embedded Systems', 'Core Engineering Roles'],
  MECH: ['Core Engineering Roles', 'Product Management'],
  CIVIL: ['Core Engineering Roles', 'Product Management'],
  BME: ['Core Engineering Roles', 'Machine Learning', 'Embedded Systems'],
  CHEM: ['Core Engineering Roles', 'Product Management'],
};

const CAREER_INTERESTS = [
  'Backend Engineering', 'Distributed Systems', 'Cloud Architecture',
  'Full Stack Development', 'Machine Learning Research', 'Product Engineering',
  'Developer Tooling', 'Platform Engineering', 'Data Engineering',
  'Mobile Development', 'Site Reliability', 'Embedded and IoT',
  'VLSI and Chip Design', 'Robotics', 'Fintech', 'Healthtech',
  'Higher Studies (MS)', 'Entrepreneurship', 'Technical Product Management',
  'Cybersecurity', 'Computer Vision', 'Sustainable Energy',
];

const PROFICIENCIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

module.exports = {
  DEPARTMENTS, DEPT_SKILLS, DEPT_TRACK, DESIGNATIONS, TRACK_COMPANIES,
  COMPANY_CONTEXT, FOCUS_AREAS, DEPT_FOCUS, UNIVERSAL_FOCUS,
  CAREER_INTERESTS, PROFICIENCIES,
};
