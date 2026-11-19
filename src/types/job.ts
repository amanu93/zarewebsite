export interface JobType {
  id: string;
  title: string;
  yearsOfExperience: number;
  location: string;
  type: string;
  workType: string;
  skills: string;
  startDate: string;
  endDate: string;
  description: string;
  aboutJob?: string;
  aboutCompany?: string;
}
