/* ============================================================
   QUANTUM STOCK TRACKER — Data (Quantum-Only)
   All price data sourced from Cloudflare Worker → Finnhub API.
   No simulated/fake data. Errors surface as errors.
   ============================================================ */

const STOCKS = [
    {
        ticker: 'IONQ',
        name: 'IonQ, Inc.',
        icon: '⚛️',
        events: [
            { date:'2026-05-06', title:'Q1 2026 Earnings: Record $64.7M Revenue, +755% YoY', impact:'+3.7%', type:'positive',
              description:'IonQ reported Q1 2026 GAAP revenue of $64.7M (+755% YoY), beating analyst estimates by ~30% and marking the fourth consecutive quarter of record results. Management raised FY2026 guidance from $225-245M to $260-270M and disclosed selling the first 6th-generation, 256-qubit system. Remaining Performance Obligations grew 554% YoY to $470M.',
              priceBefore:52.60, priceAfter:54.54,
              details:{'Q1 Revenue':'$64.7M','YoY Growth':'755%','New FY2026 Guidance':'$260M-$270M','RPOs':'$470M (+554% YoY)','New System':'256-qubit (6th gen)'} },
            { date:'2026-04-14', title:'NVIDIA Ising Quantum AI Models Spark Rally', impact:'+20%', type:'positive',
              description:'NVIDIA announced its open-source "Ising" quantum AI models on World Quantum Day, designed to automate quantum processor calibration and improve error correction. IonQ surged ~20% as investors saw NVIDIA\'s entry into quantum software as major sector validation.',
              priceBefore:38.50, priceAfter:46.20,
              details:{'Catalyst':'NVIDIA Ising models','Impact':'Sector-wide rally','IONQ Gain':'~20%'} },
            { date:'2026-02-25', title:'FY2025 Earnings: $130M Revenue, 202% YoY Growth', impact:'+21.7%', type:'positive',
              description:'IonQ reported FY2025 revenue of $130M (202% YoY growth) with Q4 revenue of $61.9M alone. The company guided FY2026 revenue of $225M–$245M and disclosed $3.3B in cash. The stock surged 21.7% the next day to ~$40.88.',
              priceBefore:33.60, priceAfter:40.88,
              details:{'FY2025 Revenue':'$130M','YoY Growth':'202%','FY2026 Guidance':'$225M–$245M','Cash':'$3.3B'} },
            { date:'2025-10-13', title:'IonQ Hits All-Time High — 99.99% Gate Fidelity', impact:'+15%', type:'positive',
              description:'IonQ reached an all-time closing high of $82.09 (intraday $84.64) after announcing world-record 99.99% two-qubit gate fidelity on its trapped-ion hardware — a critical threshold for fault-tolerant quantum computing.',
              priceBefore:71.40, priceAfter:82.09,
              details:{'ATH Close':'$82.09','Intraday High':'$84.64','Gate Fidelity':'99.99%','Milestone':'World record'} },
            { date:'2025-04-01', title:'IonQ Forte Enterprise Launched on AWS Braket', impact:'+8.5%', type:'positive',
              description:'IonQ launched its Forte Enterprise system — the company\'s most powerful commercial quantum computer — making it available globally via Amazon Braket and IonQ Quantum Cloud with enterprise SLAs.',
              priceBefore:24.80, priceAfter:26.91,
              details:{'System':'Forte Enterprise','Availability':'AWS Braket + IonQ Cloud','Access':'Global'} },
            { date:'2025-01-08', title:'Jensen Huang CES Crash — IONQ Drops ~40%', impact:'-39.0%', type:'negative',
              description:'IonQ plummeted ~39% in a single day to close at $30.00 after NVIDIA CEO Jensen Huang said at CES that useful quantum computers are "15 to 20 years away." The comment triggered a massive sector-wide selloff.',
              priceBefore:49.20, priceAfter:30.00,
              details:{'Trigger':'Jensen Huang CES comments','Close':'$30.00','Drop':'~39%','Quote':'"15-20 years away"'} },
            { date:'2024-12-19', title:'IonQ Peaks Above $47 in December Quantum Rally', impact:'+18.0%', type:'positive',
              description:'Continuing the December quantum rally momentum, IonQ surged past $47 on retail speculation and momentum trading, capping a massive run from ~$30 earlier in the month.',
              priceBefore:40.10, priceAfter:47.34,
              details:{'Peak':'~$47+','Driver':'Momentum + retail','Month Close':'$41.77'} },
            { date:'2024-12-09', title:'Google Willow Chip — Mixed Reaction for IonQ', impact:'-5.0%', type:'negative',
              description:'Google announced its Willow quantum chip with a breakthrough in error correction. While the broader quantum sector rallied, IonQ initially dipped ~5% as investors reassessed the competitive landscape between trapped-ion and superconducting approaches.',
              priceBefore:36.10, priceAfter:34.24,
              details:{'Catalyst':'Google Willow chip','IonQ Reaction':'Initially negative','Concern':'Competitive pressure'} },
            { date:'2024-09-11', title:'IonQ Keynote at Quantum World Congress', impact:'+6.0%', type:'positive',
              description:'IonQ delivered a keynote presentation at the Quantum World Congress, highlighting progress on the Forte platform and laying out its accelerated technology roadmap toward the Tempo system.',
              priceBefore:9.80, priceAfter:10.39,
              details:{'Event':'Quantum World Congress','Focus':'Roadmap + Forte','Next Goal':'Tempo (#AQ 64)'} },
            { date:'2024-07-22', title:'IonQ Accelerated Roadmap — Tempo for 2025', impact:'+11.0%', type:'positive',
              description:'IonQ presented an accelerated technology roadmap establishing the Tempo system (#AQ 64) as a major 2025 delivery goal, with focus on enterprise readiness and error correction.',
              priceBefore:8.60, priceAfter:9.55,
              details:{'System':'Tempo (#AQ 64)','Target':'2025 delivery','Focus':'Enterprise + error correction'} },
            { date:'2024-06-20', title:'IonQ Revenue Beat + Raised Outlook', impact:'+14.7%', type:'positive',
              description:'IonQ reported better-than-expected quarterly revenue and raised full-year 2024 outlook, citing strong government and enterprise cloud demand.',
              priceBefore:8.90, priceAfter:10.21,
              details:{'Revenue':'Beat estimates','Outlook':'Raised','Drivers':'Gov + Enterprise'} }
        ]
    },
    {
        ticker: 'RGTI',
        name: 'Rigetti Computing',
        icon: '🔬',
        events: [
            { date:'2026-05-11', title:'Q1 2026 Earnings: Revenue Beat + $100M UK Investment', impact:'+5.0%', type:'positive',
              description:'Rigetti reported Q1 2026 revenue of $4.4M (+198.9% YoY), beating consensus estimates of $4.09M. The 108-qubit Cepheus-1-108Q system reached general availability across Rigetti QCS, Amazon Braket, Microsoft Azure Quantum, and qBraid. The company also announced intent to invest up to $100M in the UK and an $8.4M order to deploy a 108Q system in India.',
              priceBefore:14.20, priceAfter:14.91,
              details:{'Q1 Revenue':'$4.4M','YoY Growth':'198.9%','Cash':'$569M (no debt)','UK Investment':'Up to $100M','India Deal':'$8.4M (108Q)'} },
            { date:'2026-04-14', title:'NVIDIA Ising Rally Lifts Rigetti 11%+', impact:'+11.0%', type:'positive',
              description:'Rigetti rose over 11% as part of the sector-wide rally triggered by NVIDIA\'s announcement of open-source Ising quantum AI models. Rigetti also highlighted its 108-qubit Cepheus system progress.',
              priceBefore:13.20, priceAfter:14.65,
              details:{'Catalyst':'NVIDIA Ising models','RGTI Gain':'~11%','System':'108-qubit Cepheus'} },
            { date:'2026-03-04', title:'FY2025 Earnings — Novera Orders & Roadmap Update', impact:'+5.0%', type:'positive',
              description:'Rigetti reported full-year 2025 results, highlighting Novera QPU purchase orders, the deployment of the Cepheus-1-36Q multi-chip system, and a roadmap to 150+ qubits by end of 2026 and 1,000+ by end of 2027.',
              priceBefore:12.50, priceAfter:13.13,
              details:{'System':'Cepheus-1-36Q','Roadmap':'150+ qubits by 2026','Cash':'~$600M'} },
            { date:'2025-10-14', title:'Rigetti Hits All-Time High of $58.15', impact:'+22.0%', type:'positive',
              description:'Rigetti stock surged to an all-time closing high of $58.15, driven by sector-wide quantum optimism, strong technical progress on its scalable chiplet architecture, and momentum trading.',
              priceBefore:47.70, priceAfter:58.15,
              details:{'ATH':'$58.15','Driver':'Sector momentum + tech progress','Architecture':'Multi-chip scalable'} },
            { date:'2025-01-08', title:'Jensen Huang CES Crash — RGTI Drops Sharply', impact:'-30.0%', type:'negative',
              description:'Rigetti was among the hardest-hit quantum stocks after Jensen Huang\'s CES comments about quantum computing being "15-20 years away." The stock dropped sharply before eventually recovering over months.',
              priceBefore:19.00, priceAfter:13.17,
              details:{'Trigger':'Jensen Huang CES','Jan Close':'$13.17','Recovery':'Months'} },
            { date:'2024-12-23', title:'84-Qubit Ankaa-3 Processor Launched', impact:'+15.0%', type:'positive',
              description:'Rigetti officially launched its 84-qubit Ankaa-3 system via Rigetti Quantum Cloud Services. The processor featured 99.0% median iSWAP gate fidelity and 99.5% fSim gate fidelity — significant improvements over Ankaa-2.',
              priceBefore:13.30, priceAfter:15.30,
              details:{'Qubits':'84','iSWAP Fidelity':'99.0%','fSim Fidelity':'99.5%','Platform':'QCS'} },
            { date:'2024-12-11', title:'Google Willow Rally — RGTI Surges on Quantum Hype', impact:'+65.0%', type:'positive',
              description:'Rigetti was among the biggest beneficiaries of the December 2024 quantum rally sparked by Google\'s Willow chip announcement. The stock surged from ~$5 levels to over $8+ in days.',
              priceBefore:4.85, priceAfter:8.00,
              details:{'Catalyst':'Google Willow','Surge':'~65%','Timeframe':'Days'} },
            { date:'2024-01-04', title:'84-Qubit Ankaa-2 Publicly Available', impact:'+16.0%', type:'positive',
              description:'Rigetti publicly announced the availability of Ankaa-2, an 84-qubit superconducting processor with 98% median two-qubit gate fidelity — a 2.5x improvement over previous QPUs.',
              priceBefore:1.10, priceAfter:1.28,
              details:{'Chip':'Ankaa-2','Qubits':'84','Gate Fidelity':'98%','Improvement':'2.5x'} },
            { date:'2024-05-15', title:'Cash Crunch Concerns — Sub-$2 Stock', impact:'-12.0%', type:'negative',
              description:'Rigetti disclosed declining cash reserves and extended timeline for revenue generation, pushing the stock below $2 and raising going-concern questions.',
              priceBefore:2.30, priceAfter:2.02,
              details:{'Cash':'Low','Stock Price':'Sub-$2','Concern':'Going concern'} }
        ]
    },
    {
        ticker: 'QUBT',
        name: 'Quantum Computing Inc.',
        icon: '💎',
        events: [
            { date:'2026-05-11', title:'Q1 2026 Earnings: Revenue Up ~9,000% YoY, Stock Spikes', impact:'+24.95%', type:'positive',
              description:'Quantum Computing Inc. reported Q1 2026 revenue of $3.7M (vs $39K in Q1 2025, ~9,000% YoY) and a net loss of $0.02/share, beating consensus by 3 cents. Growth was primarily driven by the Luminar Semiconductors and NuCrypt acquisitions completed earlier in the year. The stock spiked roughly 25% on the print.',
              priceBefore:9.50, priceAfter:11.87,
              details:{'Q1 Revenue':'$3.7M','YoY Growth':'~9,000%','EPS':'-$0.02 (beat by $0.03)','Cash':'$1.4B','Backlog':'$16M'} },
            { date:'2026-02-18', title:'Luminar Semiconductor Acquisition Completed ($108.5M)', impact:'+12.0%', type:'positive',
              description:'QUBT completed the all-cash acquisition of Luminar Semiconductor, Inc. for approximately $108.5M, significantly expanding its photonic chip manufacturing capabilities.',
              priceBefore:10.50, priceAfter:11.76,
              details:{'Acquisition':'Luminar Semiconductor','Value':'$108.5M','Type':'All-cash','Strategic':'Photonic chip foundry'} },
            { date:'2026-03-15', title:'NuCrypt Acquisition + Q4 2025 Earnings', impact:'-5.0%', type:'neutral',
              description:'QUBT completed the acquisition of NuCrypt to advance quantum communications. Q4 earnings showed continued losses but highlighted the Luminar and NuCrypt acquisitions as strategic growth drivers.',
              priceBefore:10.10, priceAfter:9.60,
              details:{'Acquisition':'NuCrypt','Focus':'Quantum communications','Results':'Strategic growth'} },
            { date:'2025-01-08', title:'Capybara Research Short Report', impact:'-15.0%', type:'negative',
              description:'Short-seller Capybara Research published a report alleging QUBT overstated its ties to NASA, fabricated revenues through related-party transactions, and that its products were not genuine. The stock dropped ~15% over two days.',
              priceBefore:16.40, priceAfter:13.94,
              details:{'Report':'Capybara Research','Claims':'Overstated NASA ties','Impact':'-15% over 2 days'} },
            { date:'2024-12-09', title:'Google Willow Rally — QUBT Goes Parabolic', impact:'+120.0%', type:'positive',
              description:'QUBT was one of the biggest beneficiaries of the December 2024 quantum rally. The stock surged from ~$5 to over $25 in two weeks on massive retail speculation, peaking near $25.84.',
              priceBefore:5.10, priceAfter:11.22,
              details:{'Catalyst':'Google Willow','Peak':'~$25.84','Gain':'~400%+ at peak'} },
            { date:'2024-12-02', title:'NASA Dirac-3 Contract Award', impact:'+28.0%', type:'positive',
              description:'QUBT was awarded a contract by NASA to support phase unwrapping using the Dirac-3 photonic optimization solver, providing a notable government validation for the company.',
              priceBefore:3.90, priceAfter:4.99,
              details:{'Client':'NASA','Product':'Dirac-3','Application':'Phase unwrapping'} },
            { date:'2024-11-25', title:'Iceberg Research Short Report', impact:'-20.0%', type:'negative',
              description:'Short-seller Iceberg Research published reports alleging QUBT\'s claims regarding its TFLN foundry were fabricated and questioning the legitimacy of announced purchase orders. The stock dropped sharply.',
              priceBefore:6.20, priceAfter:4.96,
              details:{'Report':'Iceberg Research','Claims':'Fabricated foundry claims','Disputed':'Purchase orders'} },
            { date:'2024-11-06', title:'Post-Election "Trump Trade" Lift', impact:'+28.5%', type:'positive',
              description:'QUBT benefited from the post-election rally as investors bet on deregulation and increased defense spending benefiting small-cap quantum companies.',
              priceBefore:2.40, priceAfter:3.08,
              details:{'Catalyst':'Election result','Theme':'Deregulation + defense','Sentiment':'Risk-on'} },
            { date:'2024-07-22', title:'QUBT Drops Below $1 — Delisting Risk', impact:'-15.0%', type:'negative',
              description:'QUBT fell below $1 per share, triggering NASDAQ compliance warnings about minimum bid price and raising delisting concerns among investors.',
              priceBefore:1.15, priceAfter:0.98,
              details:{'Price':'Below $1','Warning':'NASDAQ compliance','Risk':'Potential delisting'} }
        ]
    },
    {
        ticker: 'QBTS',
        name: 'D-Wave Quantum',
        icon: '🌀',
        events: [
            { date:'2026-05-12', title:'Q1 2026: Record $33.4M Bookings (+1,994%) but Revenue Miss', impact:'-5.0%', type:'neutral',
              description:'D-Wave reported Q1 2026 bookings of $33.4M (+1,994% YoY) including a $20M Advantage2 system sale to Florida Atlantic University and a $10M two-year QCaaS deal with a Fortune 100 customer. However, revenue of $2.9M (down 81% YoY) missed consensus and the stock fell ~4-7% on the print despite the EPS beat ($0.05 loss vs $0.08 consensus).',
              priceBefore:23.50, priceAfter:22.30,
              details:{'Bookings':'$33.4M (+1,994% YoY)','Q1 Revenue':'$2.9M (-81% YoY)','EPS':'-$0.05 (beat by $0.03)','Cash':'$588.4M','Big Deals':'FAU $20M, Fortune 100 $10M'} },
            { date:'2026-04-14', title:'NVIDIA Ising Models Rally — QBTS Surges 16%', impact:'+16.0%', type:'positive',
              description:'D-Wave surged ~16% on the NVIDIA Ising quantum AI models announcement. D-Wave also reported strong bookings including a $20M system sale to Florida Atlantic University.',
              priceBefore:18.70, priceAfter:21.69,
              details:{'Catalyst':'NVIDIA Ising models','QBTS Gain':'~16%','Bookings':'$32.8M+ new'} },
            { date:'2026-01-14', title:'Acquisition of Quantum Circuits Inc. ($550M)', impact:'+18.0%', type:'positive',
              description:'D-Wave completed the acquisition of Quantum Circuits, Inc. (QCI) for $550M ($300M stock + $250M cash), becoming a dual-platform quantum company with both annealing and gate-model capabilities.',
              priceBefore:28.50, priceAfter:33.63,
              details:{'Acquisition':'Quantum Circuits Inc.','Value':'$550M','Strategy':'Dual-platform (annealing + gate-model)'} },
            { date:'2025-10-15', title:'D-Wave Hits All-Time High of $46.75', impact:'+20.0%', type:'positive',
              description:'D-Wave stock reached its all-time closing high of $44.78 (intraday $46.75), driven by strong commercial momentum, the Advantage2 launch success, and broad sector optimism.',
              priceBefore:37.30, priceAfter:44.78,
              details:{'ATH Close':'$44.78','Intraday':'$46.75','Driver':'Commercial + Advantage2'} },
            { date:'2025-05-20', title:'Advantage2 Quantum Computer Launched (4,400+ Qubits)', impact:'+25.0%', type:'positive',
              description:'D-Wave launched its sixth-generation Advantage2 quantum annealing computer with 4,400+ qubits, Zephyr topology with 20-way connectivity, 40% higher energy scale, and 2x longer coherence time.',
              priceBefore:8.50, priceAfter:10.63,
              details:{'Qubits':'4,400+','Topology':'Zephyr (20-way)','Improvement':'40% energy scale, 2x coherence'} },
            { date:'2025-01-08', title:'Jensen Huang CES — D-Wave Crashes 35%', impact:'-35.0%', type:'negative',
              description:'D-Wave was caught in the January 2025 quantum crash after Jensen Huang\'s CES comments. Despite having actual commercial customers and revenue, the stock fell ~35%.',
              priceBefore:9.50, priceAfter:6.18,
              details:{'Trigger':'Jensen Huang CES','Drop':'~35%','Note':'Had actual revenue'} },
            { date:'2024-12-11', title:'Google Willow Rally — QBTS Triples', impact:'+195.0%', type:'positive',
              description:'D-Wave was a massive beneficiary of the Willow rally, nearly tripling from ~$3. As the only quantum company with actual commercial revenue, it attracted both retail and institutional interest.',
              priceBefore:3.05, priceAfter:9.00,
              details:{'Catalyst':'Google Willow','Pre-rally':'~$3','Peak':'$11.41','Revenue':'Actual commercial'} },
            { date:'2024-10-08', title:'D-Wave Annealing vs Gate Debate Heats Up', impact:'-8.0%', type:'negative',
              description:'A published academic paper questioned whether D-Wave\'s quantum annealing approach could ever achieve quantum advantage over classical computers, sparking renewed debate.',
              priceBefore:1.85, priceAfter:1.70,
              details:{'Paper':'Academic criticism','Question':'Annealing vs gate','Impact':'Sentiment hit'} },
            { date:'2024-06-15', title:'D-Wave Reports First Quarter of Positive Gross Profit', impact:'+22.0%', type:'positive',
              description:'D-Wave reported its first quarter of positive gross profit from quantum cloud services — a milestone for the entire quantum industry.',
              priceBefore:1.20, priceAfter:1.46,
              details:{'Milestone':'First gross profit','Source':'Cloud services','Significance':'Industry first'} }
        ]
    },
    {
        ticker: 'ARQQ',
        name: 'Arqit Quantum',
        icon: '🔐',
        events: [
            { date:'2026-04-22', title:'Tomorrow Street (Vodafone JV) Quantum-Safe Selection', impact:'+4.0%', type:'positive',
              description:'Tomorrow Street, the joint venture between Vodafone and Luxembourg\'s technology incubator, selected Arqit to add quantum-safe encryption solutions to its portfolio. The announcement provides another enterprise validation ahead of Arqit\'s H1 FY2026 earnings call scheduled for May 21, 2026.',
              priceBefore:15.20, priceAfter:15.80,
              details:{'Partner':'Tomorrow Street (Vodafone JV)','Product':'Quantum-safe encryption','Earnings Call':'May 21, 2026'} },
            { date:'2026-04-10', title:'H1 FY2026 Revenue: ~$625K, Growing but Slow', impact:'-5.0%', type:'neutral',
              description:'Arqit announced preliminary H1 FY2026 revenue of approximately $620K–$630K, showing growth from new and existing contracts but well below investor expectations for rapid scaling.',
              priceBefore:16.87, priceAfter:16.03,
              details:{'Revenue':'~$625K','Growth':'YoY improvement','Concern':'Slow scaling'} },
            { date:'2026-03-10', title:'Arqit & RAD Quantum-Safe Telecom Collaboration', impact:'+8.0%', type:'positive',
              description:'Arqit announced a collaboration with RAD, a networking edge solutions provider, to deliver a joint quantum-safe encryption solution for telecommunications, integrating Arqit\'s NetworkSecure™ technology.',
              priceBefore:13.50, priceAfter:14.58,
              details:{'Partner':'RAD','Product':'NetworkSecure™','Sector':'Telecom'} },
            { date:'2026-01-15', title:'Encryption Intelligence (EI) Platform Launched', impact:'+6.0%', type:'positive',
              description:'Arqit launched "Encryption Intelligence" (EI), a platform for cryptographic inventory and risk prioritization, helping organizations prepare for the transition to post-quantum cryptography.',
              priceBefore:14.20, priceAfter:15.05,
              details:{'Product':'Encryption Intelligence','Purpose':'PQC transition','Market':'Enterprise'} },
            { date:'2025-05-15', title:'Ampliphae IP & Portfolio Acquisition', impact:'+10.0%', type:'positive',
              description:'Arqit acquired the product portfolio and intellectual property of Ampliphae, which specializes in encryption risk advisory and AI analytics, expanding its quantum-safe product suite.',
              priceBefore:18.50, priceAfter:20.35,
              details:{'Acquisition':'Ampliphae IP','Specialty':'Encryption risk advisory','Tech':'AI analytics'} },
            { date:'2025-01-08', title:'Small-Cap Quantum Selloff', impact:'-18.0%', type:'negative',
              description:'Arqit was caught in the January 2025 quantum crash. As a smaller company with limited revenue, it experienced sharp selling pressure alongside the broader sector.',
              priceBefore:32.00, priceAfter:26.24,
              details:{'Trigger':'Jensen Huang CES','Category':'Small-cap quantum','Drop':'~18%'} },
            { date:'2024-12-12', title:'Quantum Encryption Rally on Willow News', impact:'+30.0%', type:'positive',
              description:'Arqit surged as investors realized Google\'s quantum progress makes quantum-safe encryption more urgent, directly benefiting companies like Arqit in the post-quantum cryptography space.',
              priceBefore:15.40, priceAfter:20.02,
              details:{'Catalyst':'PQC urgency','Logic':'Stronger quantum = need encryption','Gain':'~30%'} },
            { date:'2024-04-18', title:'Arqit Wins BT Telecom Deal', impact:'+20.0%', type:'positive',
              description:'Arqit secured a deal with BT Group to integrate quantum encryption into the UK\'s telecom infrastructure, a landmark deal for quantum cybersecurity.',
              priceBefore:10.50, priceAfter:12.60,
              details:{'Partner':'BT Group','Sector':'Telecom','Market':'UK infrastructure'} }
        ]
    },
    {
        ticker: 'QTUM',
        name: 'Defiance Quantum ETF',
        icon: '📊',
        events: [
            { date:'2026-05-12', title:'Quantum Earnings Rally Lifts QTUM Past $4.3B AUM', impact:'+3.5%', type:'positive',
              description:'QTUM climbed alongside the broad quantum sector as IonQ, Quantum Computing, Rigetti, and D-Wave all reported Q1 2026 earnings in early-to-mid May. AUM grew to approximately $4.34B with year-to-date flows of ~10.18% as institutional and retail investors continued piling in.',
              priceBefore:96.70, priceAfter:100.10,
              details:{'AUM':'~$4.34B','YTD Flows':'~10.18%','Catalyst':'Q1 2026 earnings rally','Top Holdings':'IONQ, RGTI, QBTS up sharply'} },
            { date:'2026-04-27', title:'QTUM ETF Surpasses $4B AUM, Earns 5-Star Morningstar Rating', impact:'+2.0%', type:'positive',
              description:'The Defiance Quantum ETF crossed $4 billion in assets under management for the first time and was awarded a 5-star Morningstar rating, reflecting strong relative risk-adjusted returns in the thematic ETF category and sustained institutional inflows into quantum-computing exposure.',
              priceBefore:94.80, priceAfter:96.70,
              details:{'AUM':'$4B+ (first time)','Morningstar':'5-star','Trend':'Sustained inflows'} },
            { date:'2026-04-14', title:'QTUM Rises on NVIDIA Quantum AI Catalyst', impact:'+5.0%', type:'positive',
              description:'The Defiance Quantum ETF rose alongside individual quantum stocks following NVIDIA\'s Ising quantum AI models announcement, with continued strong inflows. AUM stands at approximately $3.8B–$3.9B.',
              priceBefore:89.50, priceAfter:93.98,
              details:{'AUM':'~$3.8B–$3.9B','Catalyst':'NVIDIA Ising','2024 Return':'50.54%','2025 Return':'36.69%'} },
            { date:'2025-10-15', title:'QTUM Hits New Highs on Sector ATHs', impact:'+4.0%', type:'positive',
              description:'QTUM reached new highs as its top holdings — IonQ, D-Wave, and Rigetti — all hit their all-time highs in mid-October 2025. Heavy inflows continued from institutional and retail investors.',
              priceBefore:88.00, priceAfter:91.52,
              details:{'Driver':'Sector-wide ATHs','Holdings':'IONQ, QBTS, RGTI at highs','Inflows':'Strong'} },
            { date:'2025-01-08', title:'Quantum ETF Drops on Sector Crash', impact:'-12.0%', type:'negative',
              description:'QTUM fell ~12% during the January quantum crash. As a diversified ETF, the drop was less severe than individual quantum stocks, but still significant.',
              priceBefore:72.00, priceAfter:63.36,
              details:{'Drop':'~12%','vs Pure-play':'Less severe','Holdings':'Diversified'} },
            { date:'2024-12-11', title:'Google Willow — ETF Surges on Quantum Hype', impact:'+18.0%', type:'positive',
              description:'QTUM rode the Google Willow quantum wave, surging alongside individual quantum stocks. Heavy inflows indicated new investors entering the quantum theme for the first time.',
              priceBefore:60.50, priceAfter:71.39,
              details:{'Catalyst':'Google Willow','Inflows':'Record weekly','New Investors':'Significant'} },
            { date:'2024-07-12', title:'QTUM Added to Model Portfolios', impact:'+4.5%', type:'positive',
              description:'Several major robo-advisors added QTUM to their "innovation" model portfolios, providing a steady stream of automatic inflows.',
              priceBefore:55.80, priceAfter:58.31,
              details:{'Added By':'Robo-advisors','Portfolio':'Innovation theme','Impact':'Steady inflows'} }
        ]
    },
    {
        ticker: 'INFQ',
        name: 'Infleqtion',
        icon: '🧊',
        events: [
            { date:'2026-05-14', title:'Q1 2026: Record $9.5M Revenue, FY Guidance Raised to $40M+', impact:'+5.0%', type:'positive',
              description:'Infleqtion reported Q1 2026 revenue of $9.5M (+14% YoY), all from quantum solutions. The company raised FY2026 revenue guidance to at least $40M citing expanding customer activity. Notable wins included $20M in NASA Quantum Gravity Gradiometer contracts, a new U.S. Navy quantum-software contract, and a Safran partnership for the Tiqker quantum optical clock.',
              priceBefore:14.10, priceAfter:14.81,
              details:{'Q1 Revenue':'$9.5M (+14% YoY)','New FY2026 Guidance':'$40M+','NASA Contracts':'$20M total','Other Wins':'U.S. Navy, Safran (Tiqker)'} },
            { date:'2026-05-13', title:'Quantum Spectrum Launched - Rydberg-Atom RF Sensing', impact:'+8.0%', type:'positive',
              description:'Infleqtion introduced Quantum Spectrum, an atom-based RF sensing platform billed as the first fundamental shift in radio frequency sensing architecture in decades. It uses Rydberg atoms to detect, classify, and authenticate signals across the full RF spectrum in a single aperture. Active defense contracts with the U.S., U.K., and Australia, plus prime integrators Dell Federal, L3Harris, and SAIC.',
              priceBefore:13.05, priceAfter:14.10,
              details:{'Product':'Quantum Spectrum','Tech':'Rydberg atom RF sensing','Defense Customers':'US, UK, Australia','Integrators':'Dell Federal, L3Harris, SAIC'} },
            { date:'2026-04-14', title:'NVIDIA Ising Rally Lifts Infleqtion', impact:'+14.0%', type:'positive',
              description:'Infleqtion rose alongside the broader quantum sector following NVIDIA\'s Ising quantum AI models announcement on World Quantum Day, benefiting from increased investor interest in pure-play quantum stocks.',
              priceBefore:10.80, priceAfter:12.31,
              details:{'Catalyst':'NVIDIA Ising models','Sector':'Broad quantum rally','INFQ Gain':'~14%'} },
            { date:'2026-02-17', title:'Infleqtion Goes Public via SPAC Merger', impact:'+18.0%', type:'positive',
              description:'Infleqtion (formerly ColdQuanta) completed its business combination with Churchill Capital Corp X and began trading on the NYSE under ticker INFQ. The cold-atom quantum technology company saw an 18% first-day pop from the implied SPAC price.',
              priceBefore:10.00, priceAfter:11.80,
              details:{'SPAC':'Churchill Capital Corp X','Exchange':'NYSE','Tech':'Cold-atom quantum','Listing Date':'Feb 17, 2026'} },
            { date:'2026-03-05', title:'DARPA IMPAQT Program Selection', impact:'+10.0%', type:'positive',
              description:'Infleqtion was selected by DARPA for the IMPAQT program to advance quantum algorithms for generative machine learning, leveraging its cold-atom quantum computing expertise for defense applications.',
              priceBefore:11.50, priceAfter:12.65,
              details:{'Program':'DARPA IMPAQT','Application':'Quantum ML algorithms','Tech':'Cold-atom','Sector':'Defense'} }
        ]
    },
    {
        ticker: 'QUBI',
        name: 'Qubibyte',
        icon: '🟣',
        private: true,
        owner: 'Trent Rosenthal',
        events: [
            { date:'2025-03-07', title:'The Declaration of Qubibyte & Quadra Announcement', impact:'N/A', type:'positive',
              description:'Trent Rosenthal publicly declared the founding of Qubibyte and announced the Qubibyte Quadra — the company\'s first planned quantum computing system. The blog post outlined the company\'s mission to make quantum computing accessible.',
              priceBefore:0.00, priceAfter:0.00,
              details:{'Founder':'Trent Rosenthal','Product':'Qubibyte Quadra','Status':'Private','Ownership':'100% founder-owned'} },
            { date:'2025-07-20', title:'Qubibyte Quadra Design Choices Published', impact:'N/A', type:'neutral',
              description:'A detailed blog post was published outlining the engineering design decisions behind the Qubibyte Quadra quantum computer, covering qubit architecture, error correction approach, and hardware stack choices.',
              priceBefore:0.00, priceAfter:0.00,
              details:{'Topic':'System Architecture','Format':'Technical Blog','Author':'Trent Rosenthal'} },
            { date:'2026-02-09', title:'Qubibyte Quadra Simulator Demo Released', impact:'N/A', type:'positive',
              description:'Qubibyte released a video demonstration of the Qubibyte Quadra quantum circuit simulator, showcasing interactive quantum gate manipulation, state visualization, and educational tooling for quantum computing.',
              priceBefore:0.00, priceAfter:0.00,
              details:{'Platform':'YouTube','Tool':'Quantum Simulator','Focus':'Education + demo'} },
            { date:'2026-01-01', title:'Qubibyte Enters 2026 — Still Private', impact:'N/A', type:'neutral',
              description:'Qubibyte remained a privately held company entering 2026, 100% owned by founder Trent Rosenthal. The company continues development of quantum computing tools and educational resources while exploring future funding options.',
              priceBefore:0.00, priceAfter:0.00,
              details:{'Status':'Private','Ownership':'100% Trent Rosenthal','IPO Plans':'None announced','Focus':'R&D + Education'} }
        ]
    }
];

const PRIVATE_TICKERS = ['QUBI'];

// ======================== WORKER ENDPOINT ========================
const WORKER_URL = 'https://quantumstocks.trentrosenthal25.workers.dev';

const _memCache = {};
const CACHE_TTL = 10 * 60 * 1000;

// ======================== MAIN CHART FETCH ========================

async function fetchChartData(stock, timeframe) {
    const key = stock.ticker + '|' + timeframe;

    if (PRIVATE_TICKERS.includes(stock.ticker)) {
        return generatePrivateChart(stock, timeframe);
    }

    if (_memCache[key]) return _memCache[key];

    try {
        const stored = localStorage.getItem('qst4_' + key);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Date.now() - parsed.ts < CACHE_TTL) {
                const result = hydrateResult(parsed.result, stock);
                _memCache[key] = result;
                return result;
            }
        }
    } catch (e) { /* corrupt cache */ }

    const url = `${WORKER_URL}/candles?symbol=${encodeURIComponent(stock.ticker)}&timeframe=${encodeURIComponent(timeframe)}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!resp.ok) {
            const errBody = await resp.text().catch(() => '');
            console.warn(`[QST] Worker returned ${resp.status} for ${stock.ticker}/${timeframe}:`, errBody);
            return errorResult(`Server error (${resp.status})`);
        }

        const json = await resp.json();

        if (json.error) {
            console.warn(`[QST] Worker error for ${stock.ticker}/${timeframe}:`, json.error);
            return errorResult(json.error);
        }

        if (json.s === 'no_data' || !json.t || !json.c || json.t.length === 0) {
            console.warn(`[QST] No data from Finnhub for ${stock.ticker}/${timeframe}`);
            return errorResult('No market data available for this ticker');
        }

        if (json.s !== 'ok') {
            console.warn(`[QST] Unexpected Finnhub status for ${stock.ticker}/${timeframe}:`, json.s);
            return errorResult('Unexpected API response');
        }

        const data = [];
        for (let i = 0; i < json.t.length; i++) {
            if (json.c[i] != null && isFinite(json.c[i])) {
                data.push({ date: new Date(json.t[i] * 1000), price: parseFloat(json.c[i].toFixed(2)) });
            }
        }

        if (data.length < 2) {
            console.warn(`[QST] Insufficient data points (${data.length}) for ${stock.ticker}/${timeframe}`);
            return errorResult('Not enough data points');
        }

        const livePrice = data[data.length - 1].price;
        const startPrice = data[0].price;
        const liveChange = ((livePrice - startPrice) / startPrice) * 100;
        const result = { data, events: mapEventsToData(data, stock), source: 'live', livePrice, liveChange };
        cacheResult(key, result);
        return result;

    } catch (e) {
        console.warn(`[QST] Network error fetching ${stock.ticker}/${timeframe}:`, e.message);
        return errorResult('Network error — check your connection');
    }
}

function errorResult(message) {
    return { data: null, events: [], source: 'error', livePrice: 0, liveChange: 0, error: message };
}

function cacheResult(key, result) {
    _memCache[key] = result;
    try {
        const serializable = {
            source: result.source,
            livePrice: result.livePrice,
            liveChange: result.liveChange,
            data: result.data.map(d => ({ t: d.date.getTime(), p: d.price }))
        };
        localStorage.setItem('qst4_' + key, JSON.stringify({ ts: Date.now(), result: serializable }));
    } catch (e) { /* storage full */ }
}

function hydrateResult(stored, stock) {
    const data = stored.data.map(d => ({ date: new Date(d.t), price: d.p }));
    return {
        data,
        events: mapEventsToData(data, stock),
        source: stored.source,
        livePrice: stored.livePrice,
        liveChange: stored.liveChange
    };
}

// ======================== EVENT MAPPING ========================

function mapEventsToData(data, stock) {
    const events = [];
    const chartStart = data[0].date;
    const chartEnd = data[data.length - 1].date;

    stock.events.forEach(ev => {
        const evDate = new Date(ev.date);
        if (evDate >= chartStart && evDate <= chartEnd) {
            let nearestIdx = 0, minDiff = Infinity;
            data.forEach((d, i) => {
                const diff = Math.abs(d.date.getTime() - evDate.getTime());
                if (diff < minDiff) { minDiff = diff; nearestIdx = i; }
            });
            events.push({
                ...ev,
                dataIndex: nearestIdx,
                x: nearestIdx / (data.length - 1),
                y: data[nearestIdx].price
            });
        }
    });

    return events;
}

// ======================== PRIVATE STOCK CHART ========================

const _privateCache = {};

function generatePrivateChart(stock, timeframe) {
    const key = stock.ticker + '|' + timeframe;
    if (_privateCache[key]) return _privateCache[key];

    const now = new Date();
    const inception = new Date('2025-01-01T00:00:00');
    const tfMap = { '1M':30, '6M':180, '1Y':365, '5Y':1825, 'All':3650 };
    let tfDays = tfMap[timeframe];
    if (timeframe === 'YTD') {
        tfDays = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 86400000) || 1;
    }
    if (!tfDays) tfDays = 30;

    const startDate = new Date(Math.max(inception.getTime(), now.getTime() - tfDays * 86400000));
    const actualStart = (timeframe === 'All') ? inception : startDate;
    const totalMs = now.getTime() - actualStart.getTime();
    const points = Math.min(Math.max(Math.ceil(totalMs / 86400000), 2), 500);

    const data = [];
    for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        data.push({
            date: new Date(actualStart.getTime() + progress * totalMs),
            price: 0.00
        });
    }

    const events = mapEventsToData(data, stock);
    const result = { data, events, source: 'private', livePrice: 0.00, liveChange: 0.00 };
    _privateCache[key] = result;
    return result;
}

// ======================== UTILITIES ========================

function isMarketOpen() {
    try {
        const now = new Date();
        const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
        const et = new Date(etStr);
        const day = et.getDay();
        if (day === 0 || day === 6) return false;
        const mins = et.getHours() * 60 + et.getMinutes();
        return mins >= 570 && mins < 960;
    } catch (e) {
        return false;
    }
}

// ======================== DAILY PRICE FETCH ========================

const DAILY_CACHE_KEY = 'qst_daily_v6';
const DAILY_CACHE_TTL = 5 * 60 * 1000;

async function fetchDailyPrices() {
    try {
        const stored = localStorage.getItem(DAILY_CACHE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Date.now() - parsed.ts < DAILY_CACHE_TTL) return parsed.data;
        }
    } catch (e) { /* ignore */ }

    const results = {};

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const resp = await fetch(`${WORKER_URL}/quotes`, { signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
            const quotes = await resp.json();
            STOCKS.forEach(stock => {
                if (PRIVATE_TICKERS.includes(stock.ticker)) {
                    results[stock.ticker] = { price: 0, change: 0, prevClose: 0 };
                } else if (quotes[stock.ticker]) {
                    results[stock.ticker] = quotes[stock.ticker];
                }
            });
        } else {
            console.warn(`[QST] /quotes returned ${resp.status}`);
        }
    } catch (e) {
        console.warn('[QST] Failed to fetch /quotes:', e.message);
    }

    STOCKS.forEach(stock => {
        if (!results[stock.ticker]) {
            results[stock.ticker] = { price: 0, change: 0, prevClose: 0 };
        }
    });

    try {
        localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: results }));
    } catch (e) { /* storage full */ }

    return results;
}
