"use client"

import * as React from "react"
import Autoplay from "embla-carousel-autoplay"

import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import Image from "next/image"

export function CarouselPlugin() {
    const plugin = React.useRef(
        Autoplay({ delay: 4000, stopOnInteraction: true })
    )

    return (
        <Carousel
            plugins={[plugin.current]}
            className="w-full relative"
            opts={{
                align: "start",
                loop: true,
            }}
            onMouseEnter={plugin.current.stop}
            onMouseLeave={plugin.current.reset}
        >
            <CarouselContent className="relative">
                <CarouselItem>
                    <div className="p-1 h-40 w-full relative overflow-hidden">
                        <Image
                            src={'https://production-cdn.pharmacity.io/digital/1590x0/plain/e-com/images/banners/20251124071117-0-bdesk.png?versionId=NElmLqnsddm5kAImFVxKJjuTaS5jrzIc'}
                            alt="banner"
                            fill
                            className="object-cover object-bottom"
                        />
                    </div>
                </CarouselItem>
                <CarouselItem>
                    <div className="p-1 h-40 w-full relative overflow-hidden">
                        <Image
                            src={'https://production-cdn.pharmacity.io/digital/1590x0/plain/e-com/images/banners/20251125064401-0-bmb.png?versionId=x2rfl.3jYKHM4XNHgwdc2vRUyf0JpQmt'}
                            alt="banner"
                            fill
                            className="object-cover object-bottom"
                        />
                    </div>
                </CarouselItem>
                <CarouselItem>
                    <div className="p-1 h-40 w-full relative overflow-hidden">
                        <Image
                            src={'https://production-cdn.pharmacity.io/digital/1590x0/plain/e-com/images/banners/20251127073120-0-Desktopmainbanner.png?versionId=zeZX9Kjq5TMXn3b79QQbG38WPfiElYKj'}
                            alt="banner"
                            fill
                            className="object-cover object-bottom"
                        />
                    </div>
                </CarouselItem>
            </CarouselContent>

        </Carousel>
    )
}
