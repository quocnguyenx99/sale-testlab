// ─────────────────────────────────────────────────────────────
// Synthetic Identity pools (safe, non-real)
// ─────────────────────────────────────────────────────────────
export const SYNTHETIC_NAMES = [
  "Anh Minh", "Anh Huy", "Anh Nam", "Anh Quân", "Anh Phúc",
  "Anh Khang", "Anh Dũng", "Anh Long",
  "Chị Lan", "Chị Hương", "Chị Thảo", "Chị Mai",
  "Chị Vy", "Chị Linh", "Chị Ngọc", "Chị Trang",
];

export const BUYER_ROLES = [
  "Chủ doanh nghiệp nhỏ",
  "Nhân viên mua hàng",
  "IT nội bộ",
  "Kỹ thuật viên",
  "Đại lý / reseller",
  "Kế toán / hành chính",
  "Người mua cá nhân",
  "Khách dự án",
  "Chủ cửa hàng",
  "Nhân viên văn phòng được giao mua thiết bị",
];

export const ORG_TYPES = [
  "Công ty văn phòng nhỏ",
  "Công ty đang nâng cấp thiết bị",
  "Bộ phận IT nội bộ",
  "Đại lý bán lẻ thiết bị công nghệ",
  "Cửa hàng kinh doanh máy tính",
  "Nhóm mua hàng dự án",
  "Người dùng cá nhân",
  "Phòng hành chính / kế toán",
  "Doanh nghiệp cần thiết bị vận hành",
  "Đơn vị mua sắm theo nhu cầu phát sinh",
];

export type IdentityType =
  | "price_logistics"
  | "comparison_research"
  | "payment_unc"
  | "document_b2b"
  | "high_frequency";

// ─────────────────────────────────────────────────────────────
// Keyword-based persona type detection
// ─────────────────────────────────────────────────────────────
const KEYWORDS: Record<IdentityType, string[]> = {
  price_logistics:     ["khảo giá", "hỏi giá", "báo giá", "giao hàng", "thời gian giao", "tồn kho"],
  comparison_research: ["so sánh nhiều model", "so sánh", "tư vấn model", "cấu hình", "nghiên cứu"],
  payment_unc:         ["thanh toán", "UNC", "chứng từ", "cọc", "bill"],
  document_b2b:        ["yêu cầu chứng từ", "hóa đơn", "hợp đồng", "giấy tờ", "dự án"],
  high_frequency:      ["nhắn tin liên tục", "tần suất cao", "follow-up"],
};

export function detectIdentityType(personaName: string, trainingFocus: string[]): IdentityType {
  const text = (personaName + " " + trainingFocus.join(" ")).toLowerCase();
  // Priority order: payment > document > comparison > high_freq > price_logistics
  const order: IdentityType[] = ["payment_unc", "document_b2b", "comparison_research", "high_frequency", "price_logistics"];
  for (const type of order) {
    if (KEYWORDS[type].some(k => text.includes(k.toLowerCase()))) return type;
  }
  return "price_logistics"; // safe default
}

// ─────────────────────────────────────────────────────────────
// Mapping tables
// ─────────────────────────────────────────────────────────────
export const BUYER_ROLE_BY_TYPE: Record<IdentityType, string[]> = {
  price_logistics:     ["Nhân viên mua hàng", "Chủ doanh nghiệp nhỏ", "Chủ cửa hàng", "Người mua cá nhân"],
  comparison_research: ["IT nội bộ", "Kỹ thuật viên", "Người mua cá nhân", "Đại lý / reseller"],
  payment_unc:         ["Nhân viên mua hàng", "Kế toán / hành chính", "Khách dự án"],
  document_b2b:        ["Nhân viên mua hàng", "Kế toán / hành chính", "Khách dự án"],
  high_frequency:      ["Chủ doanh nghiệp nhỏ", "Nhân viên mua hàng", "Đại lý / reseller", "Chủ cửa hàng"],
};

export const ORG_TYPE_BY_TYPE: Record<IdentityType, string[]> = {
  price_logistics:     ["Công ty văn phòng nhỏ", "Công ty đang nâng cấp thiết bị", "Cửa hàng kinh doanh máy tính", "Đơn vị mua sắm theo nhu cầu phát sinh"],
  comparison_research: ["Bộ phận IT nội bộ", "Cửa hàng kinh doanh máy tính", "Người dùng cá nhân", "Công ty đang nâng cấp thiết bị"],
  payment_unc:         ["Phòng hành chính / kế toán", "Nhóm mua hàng dự án", "Doanh nghiệp cần thiết bị vận hành"],
  document_b2b:        ["Nhóm mua hàng dự án", "Phòng hành chính / kế toán", "Doanh nghiệp cần thiết bị vận hành"],
  high_frequency:      ["Cửa hàng kinh doanh máy tính", "Công ty văn phòng nhỏ", "Đơn vị mua sắm theo nhu cầu phát sinh"],
};

export const PRODUCTS_BY_TYPE: Record<IdentityType, string[]> = {
  price_logistics:     ["Máy tính xách tay", "Máy tính để bàn", "Màn hình", "Máy in", "Thiết bị văn phòng", "Phụ kiện"],
  comparison_research: ["Máy tính xách tay", "Máy tính để bàn", "Workstation", "Màn hình", "Linh kiện PC", "Gaming gear", "Thiết bị lưu trữ"],
  payment_unc:         ["Máy tính xách tay", "Máy tính để bàn", "Máy in", "Màn hình", "Thiết bị văn phòng", "Máy chủ", "Workstation"],
  document_b2b:        ["Máy chủ", "Workstation", "Thiết bị mạng", "Phần mềm", "UPS / bộ lưu điện", "Thiết bị hội nghị", "Máy chiếu"],
  high_frequency:      ["Máy tính xách tay", "Máy tính để bàn", "Màn hình", "Phụ kiện", "Linh kiện PC", "Máy in"],
};

export const PURCHASE_CONTEXT_BY_TYPE: Record<IdentityType, string> = {
  price_logistics:     "Đang cần hỏi giá và xác nhận thời gian giao trước khi quyết định mua.",
  comparison_research: "Đang so sánh nhiều model để chọn cấu hình phù hợp với nhu cầu.",
  payment_unc:         "Đang theo dõi thanh toán và chứng từ sau khi đã có nhu cầu mua rõ hơn.",
  document_b2b:        "Đang hỏi thông tin theo hướng mua hàng cho công ty hoặc nhóm nội bộ, cần đầy đủ giấy tờ.",
  high_frequency:      "Đang cần sale phản hồi nhanh để xác nhận thông tin giao hàng hoặc tồn kho.",
};

// ─────────────────────────────────────────────────────────────
// Deterministic pick by index (stable across re-runs)
// ─────────────────────────────────────────────────────────────
function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

// ─────────────────────────────────────────────────────────────
// Salutation from display name
// ─────────────────────────────────────────────────────────────
export function salutationFromName(name: string): "anh-em" | "chị-em" | "mình-bạn" {
  if (name.startsWith("Anh ")) return "anh-em";
  if (name.startsWith("Chị ")) return "chị-em";
  return "mình-bạn";
}

// ─────────────────────────────────────────────────────────────
// Role prompt builder
// ─────────────────────────────────────────────────────────────
export function buildEnrichedRolePrompt(
  displayName: string,
  buyerRole: string,
  orgType: string,
  identityType: IdentityType,
  salutationStyle: string,
): string {
  const pronoun = salutationStyle === "chị-em" ? "bạn/chị" : "bạn/anh";
  const behaviorDesc = {
    price_logistics:     "hỏi giá, kiểm tra thời gian giao và xác nhận tồn kho",
    comparison_research: "so sánh nhiều model, hỏi kỹ cấu hình trước khi quyết định",
    payment_unc:         "hỏi thanh toán, theo dõi chứng từ và xác nhận bước thanh toán",
    document_b2b:        "yêu cầu hóa đơn, giấy tờ và xác nhận quy trình mua hàng B2B",
    high_frequency:      "nhắn tin liên tục, kỳ vọng sale phản hồi nhanh và rõ ý",
  }[identityType];

  return (
    `Bạn là ${displayName}, một khách hàng giả lập đang trao đổi với sale qua Zalo. ` +
    `${pronoun} đang trong vai trò ${buyerRole} của ${orgType}. ` +
    `Hành vi chính của ${pronoun} là ${behaviorDesc}. ` +
    `Chỉ hỏi và phản hồi dựa trên thông tin sale cung cấp. ` +
    `Không tiết lộ thông tin cá nhân, tài chính. ` +
    `Không bịa thêm thông tin ngoài hồ sơ này.`
  );
}
