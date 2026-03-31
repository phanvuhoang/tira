import type { Company } from "../shared/schema";

// In-memory data storage
export interface IStorage {
  companies: Company[];
  companyMap: Map<string, Company>; // ma_ck -> company
  financialFull: Record<string, Record<string, Record<string, any>>>; // ticker -> year -> {key: value}
  financialPC: Record<string, Record<string, Record<string, any>>>;
  industries: any[];
  mapping: Record<string, any>;
}

export class MemStorage implements IStorage {
  companies: Company[] = [];
  companyMap: Map<string, Company> = new Map();
  financialFull: Record<string, Record<string, Record<string, any>>> = {};
  financialPC: Record<string, Record<string, Record<string, any>>> = {};
  industries: any[] = [];
  mapping: Record<string, any> = {};

  async loadData() {
    const fs = await import("fs");
    const path = await import("path");

    const dataDir = path.resolve(process.cwd(), "data");
    
    console.log("Loading data from:", dataDir);

    // Load companies
    const companiesRaw = JSON.parse(fs.readFileSync(path.join(dataDir, "data_companies.json"), "utf-8"));
    this.companies = companiesRaw;
    for (const c of this.companies) {
      this.companyMap.set(c.ma_ck, c);
    }
    console.log(`Loaded ${this.companies.length} companies`);

    // Load financial data
    this.financialFull = JSON.parse(fs.readFileSync(path.join(dataDir, "data_financial_full.json"), "utf-8"));
    console.log(`Loaded ${Object.keys(this.financialFull).length} parent financial records`);

    this.financialPC = JSON.parse(fs.readFileSync(path.join(dataDir, "data_financial_pc.json"), "utf-8"));
    console.log(`Loaded ${Object.keys(this.financialPC).length} consolidated financial records`);

    // Load industries
    this.industries = JSON.parse(fs.readFileSync(path.join(dataDir, "data_industries.json"), "utf-8"));
    console.log(`Loaded ${this.industries.length} industries`);

    // Load mapping
    this.mapping = JSON.parse(fs.readFileSync(path.join(dataDir, "data_mapping.json"), "utf-8"));
    console.log(`Loaded ${Object.keys(this.mapping).length} mapping items`);
  }

  getCompany(ma_ck: string): Company | undefined {
    return this.companyMap.get(ma_ck);
  }

  getFinancialData(ticker: string, reportType: string): Record<string, Record<string, any>> | undefined {
    const key = `${ticker} - ${reportType}`;
    if (reportType === "Parent") {
      return this.financialFull[key];
    } else {
      return this.financialPC[key];
    }
  }

  getIndustryCompanies(nganh_2: string): Company[] {
    return this.companies.filter(c => c.nganh_2 === nganh_2);
  }

  getIndustryFinancialData(nganh_2: string, year: string, reportType: string): Record<string, any>[] {
    const industryCompanies = this.getIndustryCompanies(nganh_2);
    const results: Record<string, any>[] = [];
    for (const c of industryCompanies) {
      const finData = this.getFinancialData(c.ma_ck, reportType);
      if (finData && finData[year]) {
        results.push(finData[year]);
      }
    }
    return results;
  }

  getAvailableTickers(reportType: string): string[] {
    const data = reportType === "Parent" ? this.financialFull : this.financialPC;
    return Object.keys(data).map(k => k.replace(` - ${reportType}`, ""));
  }

  searchCompanies(query: string): Company[] {
    const q = query.toLowerCase();
    return this.companies.filter(c =>
      c.ma_ck.toLowerCase().includes(q) ||
      (c.ten_tv && c.ten_tv.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q))
    ).slice(0, 30);
  }

  getUniqueIndustries(): string[] {
    const set = new Set<string>();
    for (const c of this.companies) {
      if (c.nganh_2) set.add(c.nganh_2);
    }
    return Array.from(set).sort();
  }
}

export const storage = new MemStorage();
