import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type {
  DemoProperty,
  DemoLead,
  DemoContract,
  DemoTransaction,
  DemoTask,
  DemoAppointment,
  DemoActivity,
} from "@/data/demoData";

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  organization: string;
  organization_id: string;
  createdAt: Date;
}

export interface DemoStats {
  totalProperties: number;
  activeProperties: number;
  totalLeads: number;
  activeLeads: number;
  newLeadsThisWeek: number;
  activeContracts: number;
  pendingContracts: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  balance: number;
  pipelineValue: number;
  conversionRate: number;
  closedValue: number;
}

export interface DemoData {
  properties: DemoProperty[];
  leads: DemoLead[];
  contracts: DemoContract[];
  transactions: DemoTransaction[];
  tasks: DemoTask[];
  appointments: DemoAppointment[];
}

interface DemoContextType {
  isDemoMode: boolean;
  isDemoLoading: boolean;
  demoUser: DemoUser | null;
  startDemo: () => void;
  endDemo: () => void;
  
  // Demo data
  demoData: DemoData;
  
  // Calculated stats
  demoStats: DemoStats;
  
  // Recent activities
  recentActivities: DemoActivity[];
  
  // Today's items
  todayTasks: DemoTask[];
  todayAppointments: DemoAppointment[];
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_SESSION_KEY = "habitae_demo_session";

function generateDemoId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const emptyDemoData: DemoData = {
  properties: [],
  leads: [],
  contracts: [],
  transactions: [],
  tasks: [],
  appointments: [],
};

const emptyStats: DemoStats = {
  totalProperties: 0,
  activeProperties: 0,
  totalLeads: 0,
  activeLeads: 0,
  newLeadsThisWeek: 0,
  activeContracts: 0,
  pendingContracts: 0,
  monthlyRevenue: 0,
  monthlyExpenses: 0,
  balance: 0,
  pipelineValue: 0,
  conversionRate: 0,
  closedValue: 0,
};

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null);
  const [loadedData, setLoadedData] = useState<{
    data: DemoData;
    stats: DemoStats;
    activities: DemoActivity[];
    todayTasks: DemoTask[];
    todayAppointments: DemoAppointment[];
  } | null>(null);
  const navigate = useNavigate();

  const isDemoMode = demoUser !== null;

  // PERF: Dynamic import — only loads ~50kb demo data when demo mode is active
  useEffect(() => {
    if (isDemoMode && !loadedData) {
      import("@/data/demoData").then((mod) => {
        setLoadedData({
          data: {
            properties: mod.demoProperties,
            leads: mod.demoLeads,
            contracts: mod.demoContracts,
            transactions: mod.demoTransactions,
            tasks: mod.demoTasks,
            appointments: mod.demoAppointments,
          },
          stats: mod.calculateDemoStats(),
          activities: mod.demoActivities,
          todayTasks: mod.getTodayDemoTasks(),
          todayAppointments: mod.getTodayDemoAppointments(),
        });
      });
    }
    if (!isDemoMode && loadedData) {
      setLoadedData(null);
    }
  }, [isDemoMode, loadedData]);

  // Check for existing demo session on mount
  useEffect(() => {
    const storedSession = sessionStorage.getItem(DEMO_SESSION_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setDemoUser({
          ...parsed,
          createdAt: new Date(parsed.createdAt),
        });
      } catch {
        sessionStorage.removeItem(DEMO_SESSION_KEY);
      }
    }
  }, []);

  const startDemo = useCallback(() => {
    const newDemoUser: DemoUser = {
      id: generateDemoId(),
      email: "demo@habitae.app",
      name: "Usuário Demo",
      organization: "Demonstração Habitae",
      organization_id: "demo-org-001",
      createdAt: new Date(),
    };

    setDemoUser(newDemoUser);
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(newDemoUser));
    navigate("/dashboard");
  }, [navigate]);

  const endDemo = useCallback(() => {
    setDemoUser(null);
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    navigate("/demo");
  }, [navigate]);

  const contextValue = useMemo(() => ({
    isDemoMode,
    isDemoLoading: isDemoMode && !loadedData,
    demoUser,
    startDemo,
    endDemo,
    demoData: loadedData?.data ?? emptyDemoData,
    demoStats: loadedData?.stats ?? emptyStats,
    recentActivities: loadedData?.activities ?? [],
    todayTasks: loadedData?.todayTasks ?? [],
    todayAppointments: loadedData?.todayAppointments ?? [],
  }), [isDemoMode, demoUser, startDemo, endDemo, loadedData]);

  return (
    <DemoContext.Provider value={contextValue}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}
