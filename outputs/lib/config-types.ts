export type RoleRate = {
  role: string;
  dayRate: number;
  nightRate: number;
  sundayRate: number;
  publicHolidayRate: number;
};

export type AppConfig = {
  company: {
    name: string;
    abn: string;
    defaultQuoteValidityDays: number;
  };
  labour: {
    minimumCallHours: number;
    dayStartHour: number;
    nightStartHour: number;
    overtimeAfterHours: number;
    doubleTimeAfterHours: number;
  };
  gst: {
    enabledByDefault: boolean;
    rate: number;
  };
  quote: {
    termsAndConditions: string;
  };
  rates: RoleRate[];
};