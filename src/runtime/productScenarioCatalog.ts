export interface ProductScenario {
  scenario_id: string;
  category: string;
  scenario_product: string;
  scenario_need: string;
  scenario_priority: string[];
  suitable_persona_patterns: string[];
  opening_templates: string[];
}

export const PRODUCT_SCENARIOS: ProductScenario[] = [
  {
    scenario_id: "laptop_van_phong_01",
    category: "Máy tính xách tay",
    scenario_product: "laptop văn phòng i5 RAM 16GB SSD 512GB",
    scenario_need: "mua cho nhân viên văn phòng",
    scenario_priority: ["giá", "tồn kho", "giao hàng"],
    suitable_persona_patterns: ["laptop", "máy tính xách tay", "notebook", "văn phòng"],
    opening_templates: [
      "Em ơi, bên mình còn laptop văn phòng i5 RAM 16GB không?",
      "Anh cần laptop văn phòng i5 RAM 16GB SSD 512GB, bên em còn sẵn hàng không?",
      "Mình đang tìm laptop văn phòng cho đội ngũ, bên em gửi giúp vài mẫu i5 phù hợp nhé."
    ]
  },
  {
    scenario_id: "desktop_01",
    category: "Máy tính để bàn",
    scenario_product: "máy tính để bàn văn phòng i5 RAM 16GB",
    scenario_need: "lắp máy đồng bộ cho văn phòng",
    scenario_priority: ["cấu hình", "giá", "bảo hành"],
    suitable_persona_patterns: ["máy bàn", "desktop", "pc văn phòng", "máy tính để bàn"],
    opening_templates: [
      "Bên em có bộ máy tính để bàn i5 RAM 16GB cho văn phòng không?",
      "Anh cần máy bàn cho nhân viên kế toán, bên em tư vấn cấu hình phù hợp giúp anh nhé.",
      "Máy tính để bàn văn phòng bên mình đang có mẫu nào sẵn hàng vậy em?"
    ]
  },
  {
    scenario_id: "mini_pc_01",
    category: "Mini PC / NUC",
    scenario_product: "mini PC/NUC i3 hoặc i5 cho văn phòng",
    scenario_need: "mua máy nhỏ gọn cho bàn làm việc",
    scenario_priority: ["cấu hình", "giá", "tồn kho", "bảo hành"],
    suitable_persona_patterns: ["mini pc", "nuc", "máy nhỏ gọn"],
    opening_templates: [
      "Anh đang xem mini PC/NUC cho văn phòng, bên mình có sẵn hàng không em?",
      "Bên em có mini PC i5 nhỏ gọn để bàn làm việc không?",
      "Mình cần NUC cho văn phòng, em gửi giúp cấu hình và giá nhé."
    ]
  },
  {
    scenario_id: "workstation_01",
    category: "Workstation",
    scenario_product: "workstation cho thiết kế/kỹ thuật",
    scenario_need: "mua máy cấu hình mạnh cho công việc chuyên môn",
    scenario_priority: ["cấu hình", "giá", "bảo hành"],
    suitable_persona_patterns: ["workstation", "máy trạm", "render", "đồ họa", "kỹ thuật"],
    opening_templates: [
      "Bên em có workstation nào phù hợp render 3D không?",
      "Anh cần máy trạm cho thiết kế kỹ thuật, bên em tư vấn cấu hình giúp anh nhé.",
      "Workstation bên mình có mẫu nào RAM 32GB trở lên không em?"
    ]
  },
  {
    scenario_id: "server_01",
    category: "Máy chủ",
    scenario_product: "máy chủ cho hệ thống nội bộ doanh nghiệp",
    scenario_need: "triển khai server cho vận hành công ty",
    scenario_priority: ["cấu hình", "bảo hành", "giao hàng"],
    suitable_persona_patterns: ["server", "máy chủ", "rack", "on-prem"],
    opening_templates: [
      "Bên em có máy chủ phù hợp cho hệ thống nội bộ tầm 30 user không?",
      "Anh đang tìm server dạng rack, bên em có cấu hình nào sẵn để triển khai sớm không?",
      "Mình cần máy chủ cho công ty, em gửi giúp option cấu hình và bảo hành nhé."
    ]
  },
  {
    scenario_id: "monitor_01",
    category: "Màn hình",
    scenario_product: "màn hình 24 inch dùng văn phòng",
    scenario_need: "mua thêm màn hình cho nhân viên",
    scenario_priority: ["giá", "tồn kho", "giao hàng"],
    suitable_persona_patterns: ["màn hình", "monitor", "24 inch", "27 inch"],
    opening_templates: [
      "Màn hình 24 inch bên mình giá sao, giao hôm nay được không em?",
      "Bên em có màn hình văn phòng 24 inch nào đang sẵn hàng không?",
      "Anh cần thêm 5 màn hình 24 inch cho văn phòng, em báo giá giúp anh nhé."
    ]
  },
  {
    scenario_id: "printer_01",
    category: "Máy in",
    scenario_product: "máy in laser cho văn phòng nhỏ",
    scenario_need: "mua thiết bị in ấn cho công ty",
    scenario_priority: ["giá", "mực in", "bảo hành"],
    suitable_persona_patterns: ["máy in", "printer", "in laser", "in trắng đen"],
    opening_templates: [
      "Bên em có máy in laser nào phù hợp văn phòng nhỏ không?",
      "Anh cần máy in văn phòng bền, dễ thay mực, bên em có mẫu nào sẵn không?",
      "Mình đang tìm máy in laser cho công ty, em báo giúp vài mẫu phù hợp nhé."
    ]
  },
  {
    scenario_id: "scanner_01",
    category: "Máy scan",
    scenario_product: "máy scan tài liệu tốc độ cao",
    scenario_need: "số hóa chứng từ nội bộ",
    scenario_priority: ["tốc độ scan", "giá", "bảo hành"],
    suitable_persona_patterns: ["scan", "scanner", "số hóa", "chứng từ"],
    opening_templates: [
      "Bên em có máy scan tài liệu nào phù hợp văn phòng vừa không?",
      "Anh cần máy scan tốc độ cao để số hóa hồ sơ, bên em có model nào sẵn hàng không?",
      "Mình đang tìm máy scan A4 cho công ty, em tư vấn giúp mình nhé."
    ]
  },
  {
    scenario_id: "network_01",
    category: "Thiết bị mạng",
    scenario_product: "router/switch wifi cho văn phòng",
    scenario_need: "nâng cấp hạ tầng mạng nội bộ",
    scenario_priority: ["ổn định", "giá", "bảo hành"],
    suitable_persona_patterns: ["router", "switch", "wifi", "thiết bị mạng"],
    opening_templates: [
      "Bên em có thiết bị mạng nào phù hợp văn phòng khoảng 50 người dùng không?",
      "Anh cần switch cho văn phòng, bên em có mẫu nào dễ quản lý không?",
      "Mình đang nâng cấp wifi công ty, em gửi giúp giải pháp phù hợp nhé."
    ]
  },
  {
    scenario_id: "pc_parts_01",
    category: "Linh kiện PC",
    scenario_product: "RAM/SSD/CPU nâng cấp máy văn phòng",
    scenario_need: "nâng cấp cấu hình hiện có",
    scenario_priority: ["tương thích", "giá", "tồn kho"],
    suitable_persona_patterns: ["linh kiện", "ram", "ssd", "cpu", "nâng cấp"],
    opening_templates: [
      "Bên em có SSD 512GB và RAM 16GB để nâng cấp máy văn phòng không?",
      "Anh cần nâng cấp cấu hình máy cũ, em tư vấn giúp combo linh kiện phù hợp nhé.",
      "Mình cần linh kiện PC cho văn phòng, bên em còn sẵn hàng không?"
    ]
  },
  {
    scenario_id: "accessories_01",
    category: "Phụ kiện",
    scenario_product: "chuột, bàn phím, dock, webcam",
    scenario_need: "mua phụ kiện đồng bộ cho nhân viên",
    scenario_priority: ["giá", "số lượng", "giao hàng"],
    suitable_persona_patterns: ["phụ kiện", "chuột", "bàn phím", "webcam", "dock"],
    opening_templates: [
      "Bên em có combo phụ kiện văn phòng số lượng 20 bộ không?",
      "Anh cần mua bàn phím và chuột cho nhân viên, bên em báo giá giúp anh nhé.",
      "Mình cần webcam và dock cho họp online, bên em có sẵn hàng không?"
    ]
  },
  {
    scenario_id: "software_01",
    category: "Phần mềm",
    scenario_product: "phần mềm bản quyền cho doanh nghiệp",
    scenario_need: "trang bị phần mềm hợp lệ cho vận hành",
    scenario_priority: ["gói phù hợp", "giá", "hóa đơn"],
    suitable_persona_patterns: ["phần mềm", "license", "bản quyền", "office"],
    opening_templates: [
      "Bên em có gói phần mềm bản quyền cho văn phòng khoảng 20 user không?",
      "Anh cần mua license phần mềm cho công ty, bên em tư vấn gói phù hợp giúp anh nhé.",
      "Mình muốn tham khảo giá phần mềm bản quyền kèm hóa đơn VAT, bên em hỗ trợ được không?"
    ]
  },
  {
    scenario_id: "office_devices_01",
    category: "Thiết bị văn phòng",
    scenario_product: "thiết bị văn phòng phục vụ vận hành hằng ngày",
    scenario_need: "bổ sung thiết bị cho bộ phận hành chính",
    scenario_priority: ["giá", "tồn kho", "giao hàng"],
    suitable_persona_patterns: ["thiết bị văn phòng", "văn phòng phẩm điện tử", "hành chính"],
    opening_templates: [
      "Bên em có thiết bị văn phòng nào đang có sẵn để giao nhanh không?",
      "Anh cần bổ sung thiết bị văn phòng cho công ty, em gửi giúp danh sách phù hợp nhé.",
      "Mình đang tìm thiết bị văn phòng cho bộ phận hành chính, bên em tư vấn giúp mình."
    ]
  },
  {
    scenario_id: "smart_devices_01",
    category: "Thiết bị thông minh",
    scenario_product: "camera, khóa, cảm biến thông minh cho văn phòng",
    scenario_need: "tăng mức tự động hóa và giám sát",
    scenario_priority: ["tính năng", "giá", "bảo hành"],
    suitable_persona_patterns: ["thiết bị thông minh", "camera", "smart", "iot", "cảm biến"],
    opening_templates: [
      "Bên em có thiết bị thông minh nào phù hợp văn phòng nhỏ không?",
      "Anh cần camera và cảm biến cho văn phòng, bên em có giải pháp nào sẵn không?",
      "Mình đang tham khảo thiết bị thông minh cho công ty, em tư vấn gói phù hợp giúp mình nhé."
    ]
  }
];

export const FALLBACK_SCENARIO: ProductScenario = {
  scenario_id: "fallback_general",
  category: "Máy tính để bàn",
  scenario_product: "máy tính văn phòng cấu hình i5 RAM 16GB SSD 512GB",
  scenario_need: "mua sắm thiết bị phục vụ công việc",
  scenario_priority: ["giá", "bảo hành", "giao hàng"],
  suitable_persona_patterns: [],
  opening_templates: [
    "Em ơi, bên mình còn máy tính văn phòng cấu hình i5 RAM 16GB SSD 512GB không?",
    "Anh cần mua máy tính i5 cho công việc, bên em tư vấn giúp anh nhé.",
    "Bên mình có sẵn bộ máy bàn i5 RAM 16GB nào không em?"
  ]
};
