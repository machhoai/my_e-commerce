export const ProductDetailsNavBar = () => {
    return (
        <div className="fixed z-50 bottom-0 flex items-center w-full p-4 gap-4 border border-t-gray-200">
            <div className="text-primary ring-primary font-semibold text-base flex justify-center items-center ring-1 ring-inset flex-1 h-14 rounded-lg ani">
                Thêm vào giỏ
            </div>
            <div className="bg-primary flex-1 text-base font-bold h-14 rounded-lg flex justify-center items-center text-white text-center">
                Mua ngay
            </div>
        </div>
    );
}

export const ContactButton = () => {
    return (
        <div className="contact-button h-14 rounded-full bg-primary text-white aspect-square absolute bottom-28 right-4 z-50 p-3 flex justify-center items-center animate">
            <ion-icon name="headset" className="size-full" />
        </div>
    );
}