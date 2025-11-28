import { Montez } from "next/font/google"

const montez = Montez({ subsets: ['latin'], weight: '400' });

export default function Header({ showBack = false }) {
    return (
        <div className="flex w-full top-0 left-0 bg-white justify-between items-center sticky py-1">
            <div>
                {
                    showBack && (
                        <span className="p-1 bg-accent flex justify-center items-center rounded-full aspect-square">
                            <ion-icon name="arrow-back" class="text-[20px] text-[#727272] aspect-square !visible"></ion-icon>
                        </span>
                    )
                }
            </div>
            <div>
                <p className={`${montez.className} text-3xl text-primary`}>Dribbble</p>
            </div>
            <div>
                <span className="p-1 bg-accent flex justify-center items-center rounded-full aspect-square">
                    <ion-icon name="notifications" class="text-[20px] text-[#727272] aspect-square !visible"></ion-icon>
                </span>
            </div>
        </div>
    )
}