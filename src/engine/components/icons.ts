/* The icons the slides and docs can draw: the curated set (schema.ts ICONS) and the three the engine draws itself.
   Named imports, so the rest of lucide's thousand icons stay out of the bundle (they were most of it). A name outside
   this table draws nothing: autofix and the schema only let the curated names into a slide. */
import { Banknote, Briefcase, Building2, Calendar, ChartColumn, ChartLine, ChartPie, ChevronDown, CircleCheck, Clock, Cloud, Coins, Cpu, CreditCard, Database, Factory, FileText, Gauge, Globe, Handshake, Heart, Landmark, Layers, Leaf, Lightbulb, Lock, MapPin, Maximize2, MessageCircle, Package, PiggyBank, Puzzle, Receipt, RefreshCw, Rocket, Scale, Search, Settings, ShieldCheck, ShoppingCart, Smartphone, Sparkles, Store, Target, TrendingDown, TrendingUp, TriangleAlert, Truck, User, Users, Wallet, X, Zap } from "lucide";

/** A whole icon as lucide describes it: `[tag, attributes, children]`. */
export type IconElement = (typeof Zap);

export const ICON_NODES: Record<string, IconElement> = {
  zap: Zap, wallet: Wallet, "credit-card": CreditCard, banknote: Banknote,
  "piggy-bank": PiggyBank, landmark: Landmark, receipt: Receipt, coins: Coins,
  "building-2": Building2, store: Store, "shopping-cart": ShoppingCart, truck: Truck,
  package: Package, factory: Factory, users: Users, user: User,
  handshake: Handshake, briefcase: Briefcase, target: Target, rocket: Rocket,
  lightbulb: Lightbulb, sparkles: Sparkles, "trending-up": TrendingUp, "trending-down": TrendingDown,
  "chart-line": ChartLine, "chart-column": ChartColumn, "chart-pie": ChartPie, gauge: Gauge,
  "shield-check": ShieldCheck, lock: Lock, scale: Scale, "file-text": FileText,
  clock: Clock, calendar: Calendar, "refresh-cw": RefreshCw, globe: Globe,
  "map-pin": MapPin, layers: Layers, puzzle: Puzzle, settings: Settings,
  cpu: Cpu, database: Database, cloud: Cloud, smartphone: Smartphone,
  "message-circle": MessageCircle, search: Search, "circle-check": CircleCheck, "triangle-alert": TriangleAlert,
  leaf: Leaf, heart: Heart, "chevron-down": ChevronDown, "maximize-2": Maximize2,
  x: X,
};

/** The icon for a name as slides write it (kebab-case; lucide's PascalCase and snake_case read too). */
export const iconNode = (name: string): IconElement | undefined => ICON_NODES[name.trim().toLowerCase().replace(/[_\s]+/g, "-")];
