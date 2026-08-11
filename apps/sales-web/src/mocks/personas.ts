import type { PublicPersona } from '../types/training'

export const mockPersonas: PublicPersona[] = [
  {
    id: 'anh-nam', displayName: 'Anh Nam', initials: 'AN', role: 'CTO Startup',
    customerType: 'Công nghệ', difficulty: 'MEDIUM', color: '#2f6fed',
    summary: 'Thực tế, bận rộn và luôn muốn nhìn thấy giá trị kinh doanh trước khi quyết định.',
    interests: ['Hiệu năng', 'Chi phí', 'Bảo hành'],
    scenarioContext: 'Đang mở rộng đội kỹ thuật và cần đồng bộ thiết bị trong quý này.',
  },
  {
    id: 'chi-linh', displayName: 'Chị Linh', initials: 'CL', role: 'Trưởng phòng mua hàng',
    customerType: 'Doanh nghiệp', difficulty: 'HARD', color: '#7257d9',
    summary: 'Cẩn trọng, giỏi so sánh và thường yêu cầu điều khoản thương mại thật rõ ràng.',
    interests: ['Giá theo số lượng', 'Giao hàng', 'Điều khoản'],
    scenarioContext: 'Cần phương án mua sắm minh bạch cho nhiều phòng ban và nhiều địa điểm.',
  },
  {
    id: 'anh-huy', displayName: 'Anh Huy', initials: 'AH', role: 'Chủ doanh nghiệp',
    customerType: 'SME', difficulty: 'EASY', color: '#138b78',
    summary: 'Cởi mở, tập trung vào hiệu quả và cần một giải pháp dễ triển khai, dễ quản lý.',
    interests: ['Tính đơn giản', 'Hỗ trợ', 'Hiệu quả'],
    scenarioContext: 'Muốn nâng cấp thiết bị cho đội ngũ nhưng không có IT chuyên trách.',
  },
  {
    id: 'chi-mai', displayName: 'Chị Mai', initials: 'CM', role: 'Giám đốc vận hành',
    customerType: 'Bán lẻ', difficulty: 'MEDIUM', color: '#d16f32',
    summary: 'Quyết đoán, quan tâm tiến độ và đánh giá cao phương án giảm gián đoạn vận hành.',
    interests: ['Tiến độ', 'Độ ổn định', 'Triển khai'],
    scenarioContext: 'Chuẩn bị mở thêm chi nhánh và cần kế hoạch cung ứng đúng hạn.',
  },
  {
    id: 'anh-phong', displayName: 'Anh Phong', initials: 'AP', role: 'IT Manager',
    customerType: 'Doanh nghiệp', difficulty: 'HARD', color: '#3b647d',
    summary: 'Am hiểu kỹ thuật, hỏi sâu về cấu hình và không chấp nhận câu trả lời chung chung.',
    interests: ['Cấu hình', 'Bảo mật', 'Tương thích'],
    scenarioContext: 'Đang chuẩn hóa máy trạm cho nhóm phát triển phần mềm.',
  },
  {
    id: 'chi-thao', displayName: 'Chị Thảo', initials: 'CT', role: 'Founder Agency',
    customerType: 'Dịch vụ', difficulty: 'EASY', color: '#c15078',
    summary: 'Thân thiện, nhanh nhạy và ưu tiên trải nghiệm sử dụng cùng hình ảnh chuyên nghiệp.',
    interests: ['Thiết kế', 'Trải nghiệm', 'Linh hoạt'],
    scenarioContext: 'Cần trang bị laptop cho đội ngũ sáng tạo thường xuyên làm việc di động.',
  },
]
