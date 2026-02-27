'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { NotificationTemplate } from '@/types';
import { Plus, Edit2, Trash2, Send, CalendarClock, Info, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function NotificationTemplatesPage() {
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        titleTemplate: '',
        bodyTemplate: '',
        isSystemEvent: false
    });

    const [isSaving, setIsSaving] = useState(false);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'notification_templates'));
            const data: NotificationTemplate[] = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as NotificationTemplate);
            });
            setTemplates(data);
        } catch (error) {
            console.error("Lỗi khi tải mẫu thông báo:", error);
            setFeedback({ type: 'error', text: "Không thể tải danh sách mẫu" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleOpenForm = (template?: NotificationTemplate) => {
        if (template) {
            setEditingTemplate(template);
            setFormData({
                name: template.name,
                titleTemplate: template.titleTemplate,
                bodyTemplate: template.bodyTemplate,
                isSystemEvent: template.isSystemEvent
            });
        } else {
            setEditingTemplate(null);
            setFormData({ name: '', titleTemplate: '', bodyTemplate: '', isSystemEvent: false });
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingTemplate(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.titleTemplate || !formData.bodyTemplate) {
            setFeedback({ type: 'error', text: "Vui lòng nhập đầy đủ Tên, Tiêu đề và Nội dung" });
            return;
        }

        setIsSaving(true);
        setFeedback(null);
        try {
            const id = editingTemplate?.id || doc(collection(db, 'notification_templates')).id;
            const newTemplate: NotificationTemplate = {
                id,
                ...formData
            };

            await setDoc(doc(db, 'notification_templates', id), newTemplate);
            setFeedback({ type: 'success', text: editingTemplate ? "Cập nhật mẫu thành công" : "Tạo mẫu mới thành công" });
            handleCloseForm();
            fetchTemplates();
        } catch (error) {
            console.error("Lỗi lưu mẫu thông báo:", error);
            setFeedback({ type: 'error', text: "Đã xảy ra lỗi khi lưu" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Chắc chắn muốn xóa mẫu thông báo này? Các sự kiện đang được liên kết cũng có thể bị ảnh hưởng.")) {
            try {
                await deleteDoc(doc(db, 'notification_templates', id));
                setFeedback({ type: 'success', text: "Xóa thành công" });
                fetchTemplates();
            } catch (error) {
                console.error("Lỗi xóa mẫu:", error);
                setFeedback({ type: 'error', text: "Không thể xóa lúc này" });
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800">Mẫu Thông Báo</h1>
                    <p className="text-slate-500 mt-1">Quản lý và soạn mãu nội dung gửi đẩy tự động</p>
                </div>
                <button
                    onClick={() => handleOpenForm()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Tạo mẫu mới
                </button>
            </div>

            {feedback && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border ${feedback.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />}
                    <div className="text-sm font-medium">{feedback.text}</div>
                </div>
            )}

            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : templates.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                    <Info className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">Chưa có mẫu nào</h3>
                    <p className="text-slate-500 mt-1">Hãy tạo mẫu thông báo đầu tiên của bạn</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(template => (
                        <div key={template.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                            {template.isSystemEvent && (
                                <span className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                    Hệ thống
                                </span>
                            )}
                            <h3 className="font-semibold text-slate-800 text-lg pr-16">{template.name}</h3>
                            <div className="mt-3 bg-slate-50 p-3 rounded-lg flex-1 border border-slate-100">
                                <p className="text-sm font-medium text-slate-900 line-clamp-1">{template.titleTemplate}</p>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-3">{template.bodyTemplate}</p>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleOpenForm(template)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        title="Chỉnh sửa"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        title="Xóa mẫu"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-xs font-medium transition-colors cursor-not-allowed"
                                        title="Gửi test ngay (Đang xây dựng)"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        Test
                                    </button>
                                    <button
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md text-xs font-medium transition-colors cursor-not-allowed"
                                        title="Lên lịch định kỳ (Đang xây dựng)"
                                    >
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        Hẹn giờ
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Form */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingTemplate ? 'Chỉnh sửa Mẫu' : 'Tạo Mẫu Tự Động'}
                            </h2>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tên Mẫu (Dùng để nhận diện)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="Ví dụ: Lịch thay đổi đột xuất"
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <strong className="block mb-1">Cú pháp Hỗ trợ Biến:</strong>
                                    Bao bọc TỪ_KHÓA bằng dấu ngoặc nhọn <code className="bg-white px-1 py-0.5 rounded text-blue-600 mx-0.5">{'{'} {'}'}</code>.
                                    Hệ thống sẽ tự nhận diện và thay thế bằng dữ liệu thực.<br />
                                    <strong>Ví dụ: </strong><code className="bg-white px-1 py-0.5 rounded text-blue-600">{' {name} '}</code>, <code className="bg-white px-1 py-0.5 rounded text-blue-600">{' {storeName} '}</code>, <code className="bg-white px-1 py-0.5 rounded text-blue-600">{' {shiftDate} '}</code>.
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tiêu đề Thông báo push
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.titleTemplate}
                                    onChange={(e) => setFormData({ ...formData, titleTemplate: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="Chào {name}, ca làm ngày {shiftDate}..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nội dung thân thông báo
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formData.bodyTemplate}
                                    onChange={(e) => setFormData({ ...formData, bodyTemplate: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                                    placeholder="Bạn vừa được phân công thay cho {managerName}..."
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isSystem"
                                    checked={formData.isSystemEvent}
                                    onChange={(e) => setFormData({ ...formData, isSystemEvent: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                                <label htmlFor="isSystem" className="text-sm text-slate-700">
                                    Đánh dấu là Mẫu Sự kiện gốc (Hệ thống)
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        'Lưu thông tin'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
