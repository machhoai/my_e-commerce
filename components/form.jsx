"use client"
import React, { useState, useMemo } from 'react';
import {
    Building2, Phone, MapPin, CheckCircle2,
    AlertCircle, Save, X
} from 'lucide-react';

export default function NoScrollForm() {
    const [activeTab, setActiveTab] = useState('general');
    const [formData, setFormData] = useState({
        businessName: '', taxId: '', website: '',
        email: '', phone: '',
        address: '', city: '', district: ''
    });

    // Giả lập trạng thái lỗi để hiển thị icon cảnh báo trên Tab
    const [touched, setTouched] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBlur = (e) => {
        setTouched(prev => ({ ...prev, [e.target.name]: true }));
    };

    // Logic kiểm tra trạng thái từng phần (để hiện icon check xanh hoặc đỏ bên sidebar)
    const status = useMemo(() => {
        const isGeneralValid = formData.businessName && formData.taxId;
        const isContactValid = formData.email && formData.phone;
        const isAddressValid = formData.address && formData.city;

        return {
            general: isGeneralValid ? 'valid' : (touched.businessName ? 'error' : 'empty'),
            contact: isContactValid ? 'valid' : (touched.email ? 'error' : 'empty'),
            address: isAddressValid ? 'valid' : (touched.address ? 'error' : 'empty'),
        };
    }, [formData, touched]);

    // Menu bên trái
    const TABS = [
        { id: 'general', label: 'Thông tin chung', icon: Building2 },
        { id: 'contact', label: 'Liên hệ', icon: Phone },
        { id: 'address', label: 'Địa chỉ & Khu vực', icon: MapPin },
    ];

    return (
        // h-screen và overflow-hidden để KHÓA chiều cao màn hình, cấm scroll trang web
        <div className="fixed inset-0 bg-gray-100 flex items-center justify-center p-6 overflow-hidden font-sans">

            {/* Container chính: Card nổi ở giữa màn hình */}
            <div className="bg-white w-full max-w-5xl h-[550px] rounded-2xl shadow-2xl flex overflow-hidden">

                {/* --- LEFT SIDEBAR (NAVIGATION) --- */}
                <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="font-bold text-gray-800 text-lg">Tạo Doanh Nghiệp</h2>
                        <p className="text-xs text-gray-500 mt-1">Nhập thông tin chi tiết</p>
                    </div>

                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                        {TABS.map((tab) => {
                            const TabIcon = tab.icon;
                            const tabStatus = status[tab.id];
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all
                    ${isActive
                                            ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200'
                                            : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <TabIcon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                                        {tab.label}
                                    </div>

                                    {/* Icon trạng thái nhỏ bên phải mỗi tab */}
                                    {tabStatus === 'valid' && <CheckCircle2 size={16} className="text-green-500" />}
                                    {tabStatus === 'error' && <AlertCircle size={16} className="text-red-500" />}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-gray-200">
                        <button className="w-full py-2 text-gray-500 hover:text-red-600 text-sm font-medium">
                            Thoát
                        </button>
                    </div>
                </div>

                {/* --- RIGHT CONTENT (FORM FIELDS) --- */}
                <div className="flex-1 flex flex-col h-full bg-white relative">

                    {/* Header của phần nội dung */}
                    <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                        <h3 className="text-xl font-bold text-gray-800">
                            {TABS.find(t => t.id === activeTab)?.label}
                        </h3>
                        {/* Nút Save luôn hiển thị ở đây để dễ bấm */}
                        <div className="flex gap-3">
                            <button className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Làm lại</button>
                            <button className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center shadow-md">
                                <Save size={16} className="mr-2" /> Lưu Doanh nghiệp
                            </button>
                        </div>
                    </div>

                    {/* Khu vực nhập liệu (Scroll chỉ nằm TRONG khu vực này nếu quá dài) */}
                    <div className="flex-1 p-8 overflow-y-auto">

                        {activeTab === 'general' && (
                            <div className="grid grid-cols-2 gap-6 animate-fadeIn">
                                <div className="col-span-2">
                                    <Input label="Tên Doanh nghiệp" name="businessName" value={formData.businessName} onChange={handleChange} onBlur={handleBlur} autoFocus placeholder="Công ty TNHH..." />
                                </div>
                                <Input label="Mã số thuế" name="taxId" value={formData.taxId} onChange={handleChange} onBlur={handleBlur} placeholder="010..." />
                                <Input label="Website" name="website" value={formData.website} onChange={handleChange} placeholder="https://" required={false} />
                            </div>
                        )}

                        {activeTab === 'contact' && (
                            <div className="grid grid-cols-1 gap-6 max-w-lg animate-fadeIn">
                                <Input label="Email liên hệ" name="email" type="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} autoFocus />
                                <Input label="Số điện thoại" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} />
                            </div>
                        )}

                        {activeTab === 'address' && (
                            <div className="grid grid-cols-2 gap-6 animate-fadeIn">
                                <div className="col-span-2">
                                    <Input label="Địa chỉ chi tiết" name="address" value={formData.address} onChange={handleChange} onBlur={handleBlur} placeholder="Số nhà, đường..." autoFocus />
                                </div>
                                <Input label="Tỉnh / Thành phố" name="city" value={formData.city} onChange={handleChange} onBlur={handleBlur} />
                                <Input label="Quận / Huyện" name="district" value={formData.district} onChange={handleChange} />
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}

// Sub-component Input tối giản
const Input = ({ label, name, value, onChange, onBlur, type = "text", placeholder, required = true, autoFocus }) => (
    <div className="group">
        <label className="block text-sm font-medium text-gray-700 mb-1.5 group-focus-within:text-blue-600 transition-colors">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:outline-none transition-all"
        />
    </div>
);