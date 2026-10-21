/**
 * AboutContent 組件
 * 關於（誰做的系統）內容（InfoDialog 的 About 分頁）；取代原本的 /about 獨立頁。
 * 依介面語言只顯示一種。
 */

import React from 'react'
import { useT } from '../../stores/langStore'

// 敘事段落
const PARAGRAPHS: { en: string; zh: string }[] = [
  {
    en: "Borrowing gear has always been a required subject for the Communications Design department. In my freshman year, I heard RAGIC was hard to use, and since I happened to be into UI/UX design, I built a design prototype of an SCCD app on my own, trying to integrate every function we'd use throughout university.",
    zh: '租借，這件事情一直以來都是媒傳系必修的課題。大一的時候因為聽說 RAGIC 很難用，再加上剛好對 UI、UX 等設計感興趣，因此就自己做了一款 SCCD APP 的設計原型，設法去將所有大學時期會使用的功能進行整合。'
  },
  {
    en: 'Later I found that developing an app actually costs far more than expected, and with platforms like FB, DC and the school system growing ever more mature, building an app made little sense. (Is anyone even reading this paragraph carefully?) So I decided to focus solely on borrowing, and to solve the problems at hand in the form of a website.',
    zh: '後來經過研究發現 APP 開發的成本其實比想像中的高，再加上各個平台（FB、DC、校務系統）的使用已經愈加成熟，造成開發 APP 的意義不大。我寫這一段到底有誰會去認真看啊？因此打算只單攻租借這件事情，並以網站的形式去解決目前遇到的問題。'
  },
  {
    en: 'The platform is mainly about handling borrowing in a systematic, automated way, improving efficiency for both users and administrators. While building it, we redesigned the borrowing flow to be simpler and more user-friendly. The date picker takes after how airlines let you choose dates, the numbered-area selection works like picking seats at a cinema, and the rental list is modeled on a shopping cart.',
    zh: '平台主要想通過系統化及自動化處理租借這件事情，提高使用者和管理者的效率。在開發的時候，我們重新設計了租借流程，變得更簡化及符合使用者體驗。另外，租借日期的選擇，參考了航空公司的日期選擇方法，場地編號區採用電影院選座位的方式處理，而租借清單則參考了購物車的系統。'
  },
  {
    en: "We're really glad everyone can use the platform we built — it lets us put what we've learned into practice. This is our first time designing something this large, so please bear with us if you run into any problems while using it.",
    zh: '很開心大家可以使用我們製作的平台，讓我們學以致用。第一次製作那麽龐大的設計，如使用過程中遇到問題，還請多多包涵。'
  }
]

const QUOTE = {
  en: '"Solving problems is a form of design too; in the future everyone can build on and improve this foundation." — as Kao Chieh, a highly respected teacher in the Communications Design department, once said.',
  zh: '「解決問題也是設計的一種，未來大家都可以依照這個基礎去改進」——媒傳系一位德高望重的老師高捷，曾經說過。'
}

const AboutContent: React.FC = () => {
  const t = useT()
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {PARAGRAPHS.map((p, i) => (
          <p key={i} className="text-xs text-white leading-relaxed">{t(p.en, p.zh)}</p>
        ))}
      </div>

      <blockquote className="border-l-2 border-[#545454] pl-4">
        <p className="text-xs text-[#cccccc] leading-relaxed">{t(QUOTE.en, QUOTE.zh)}</p>
      </blockquote>
    </div>
  )
}

export default AboutContent
