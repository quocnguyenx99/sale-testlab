import type { PublicPersona } from '../types/training'

export const mockPersonas: PublicPersona[] = [
  {
    id: 'anh-nam', displayName: 'Anh Nam', initials: 'AN', role: 'CTO Startup',
    customerType: 'Công nghệ', difficulty: 'MEDIUM', color: '#2f6fed',
    summary: 'Thực tế, bận rộn và luôn muốn nhìn thấy giá trị kinh doanh trước khi quyết định.',
    interests: ['Hiệu năng', 'Chi phí', 'Bảo hành'],
    scenarioContext: 'Đang mở rộng đội kỹ thuật và cần đồng bộ thiết bị trong quý này.',
    defaultScenario: { id: 'mock-1', title: 'Mua laptop cho đội phát triển', description: 'Đồng bộ thiết bị cho đội kỹ thuật.', difficulty: 'MEDIUM' },
  },
  {
    id: 'chi-linh', displayName: 'Chị Linh', initials: 'CL', role: 'Trưởng phòng mua hàng',
    customerType: 'Doanh nghiệp', difficulty: 'HARD', color: '#7257d9',
    summary: 'Cẩn trọng, giỏi so sánh và thường yêu cầu điều khoản thương mại thật rõ ràng.',
    interests: ['Giá theo số lượng', 'Giao hàng', 'Điều khoản'],
    scenarioContext: 'Cần phương án mua sắm minh bạch cho nhiều phòng ban và nhiều địa điểm.',
    defaultScenario: { id: 'mock-2', title: 'Mua sắm thiết bị doanh nghiệp', description: 'Chuẩn bị phương án mua sắm nhiều địa điểm.', difficulty: 'HARD' },
  },
  {
    id: 'anh-huy', displayName: 'Anh Huy', initials: 'AH', role: 'Chủ doanh nghiệp',
    customerType: 'SME', difficulty: 'EASY', color: '#138b78',
    summary: 'Cởi mở, tập trung vào hiệu quả và cần một giải pháp dễ triển khai, dễ quản lý.',
    interests: ['Tính đơn giản', 'Hỗ trợ', 'Hiệu quả'],
    scenarioContext: 'Muốn nâng cấp thiết bị cho đội ngũ nhưng không có IT chuyên trách.',
    defaultScenario: { id: 'mock-3', title: 'Nâng cấp thiết bị SME', description: 'Tìm giải pháp dễ vận hành.', difficulty: 'EASY' },
  },
  {
    id: 'chi-mai', displayName: 'Chị Mai', initials: 'CM', role: 'Giám đốc vận hành',
    customerType: 'Bán lẻ', difficulty: 'MEDIUM', color: '#d16f32',
    summary: 'Quyết đoán, quan tâm tiến độ và đánh giá cao phương án giảm gián đoạn vận hành.',
    interests: ['Tiến độ', 'Độ ổn định', 'Triển khai'],
    scenarioContext: 'Chuẩn bị mở thêm chi nhánh và cần kế hoạch cung ứng đúng hạn.',
    defaultScenario: { id: 'mock-4', title: 'Thiết bị cho chi nhánh', description: 'Cung ứng đúng tiến độ.', difficulty: 'MEDIUM' },
  },
  {
    id: 'anh-phong', displayName: 'Anh Phong', initials: 'AP', role: 'IT Manager',
    customerType: 'Doanh nghiệp', difficulty: 'HARD', color: '#3b647d',
    summary: 'Am hiểu kỹ thuật, hỏi sâu về cấu hình và không chấp nhận câu trả lời chung chung.',
    interests: ['Cấu hình', 'Bảo mật', 'Tương thích'],
    scenarioContext: 'Đang chuẩn hóa máy trạm cho nhóm phát triển phần mềm.',
    defaultScenario: { id: 'mock-5', title: 'Chuẩn hóa máy trạm', description: 'Tư vấn cấu hình kỹ thuật.', difficulty: 'HARD' },
  },
  {
    id: 'chi-thao', displayName: 'Chị Thảo', initials: 'CT', role: 'Founder Agency',
    customerType: 'Dịch vụ', difficulty: 'EASY', color: '#c15078',
    summary: 'Thân thiện, nhanh nhạy và ưu tiên trải nghiệm sử dụng cùng hình ảnh chuyên nghiệp.',
    interests: ['Thiết kế', 'Trải nghiệm', 'Linh hoạt'],
    scenarioContext: 'Cần trang bị laptop cho đội ngũ sáng tạo thường xuyên làm việc di động.',
    defaultScenario: { id: 'mock-6', title: 'Laptop cho đội sáng tạo', description: 'Thiết bị làm việc di động.', difficulty: 'EASY' },
  },
]
