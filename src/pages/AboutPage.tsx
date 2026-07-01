/**
 * 關於頁面 About（標題：誰做的系統）
 * 從舊 about.html 遷移文案，現行版型：左標題、右內文（靠右）。
 * 所有英文一起、所有中文一起，quote 英中成對；內文區內部捲動、footer 固定。
 * 進場用專案標準 float-up 浮現，逐段錯開。
 */

import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'

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

// float-up 浮入段落（依序錯開）
const Para = ({ text, chinese, delay }: { text: string; chinese?: boolean; delay: number }) => (
  <div className="float-up-container">
    <p
      className={`float-up ${chinese ? "font-['Noto_Sans_TC',_sans-serif]" : "font-['Inter',_sans-serif]"} text-tiny text-white leading-relaxed`}
      style={{ animationDelay: `${delay}s` }}
    >
      {text}
    </p>
  </div>
)

const AboutPage = () => {
  return (
    <div className="bg-black text-white h-screen flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 pt-20 overflow-hidden">
        <div className="container h-full flex flex-col py-8 md:py-12">
          <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
            {/* 左：標題（不做進場動畫） */}
            <div className="flex-shrink-0">
              <h1 className="font-['Inter',_sans-serif] text-white text-medium-title">
                Who Made This
              </h1>
              <h1 className="font-['Noto_Sans_TC',_sans-serif] text-white text-medium-title">
                誰做的系統
              </h1>
            </div>

            {/* 右：內文（靠右、佔 50% 寬、內部捲動、隱藏捲軸） */}
            <div className="w-full md:w-1/2 md:ml-auto overflow-y-auto md:pr-4 space-y-10">
              {/* 所有英文 */}
              <div className="space-y-4">
                {PARAGRAPHS.map((p, i) => (
                  <Para key={`en-${i}`} text={p.en} delay={i * 0.1} />
                ))}
              </div>

              {/* 所有中文 */}
              <div className="space-y-4">
                {PARAGRAPHS.map((p, i) => (
                  <Para key={`zh-${i}`} text={p.zh} chinese delay={(PARAGRAPHS.length + i) * 0.1} />
                ))}
              </div>

              {/* 引言（英中成對）；左側線段 fade-in，delay 對齊文字，不比文字早出現 */}
              <blockquote className="relative pl-4 space-y-2">
                <span
                  aria-hidden={true}
                  className="fade-in absolute left-0 top-0 bottom-0 w-0.5 bg-[#545454]"
                  style={{ animationDelay: `${(PARAGRAPHS.length * 2 + 1) * 0.1}s` }}
                />
                <div className="float-up-container">
                  <p
                    className="float-up font-['Inter',_sans-serif] text-tiny text-[#cccccc] leading-relaxed"
                    style={{ animationDelay: `${PARAGRAPHS.length * 2 * 0.1}s` }}
                  >
                    {QUOTE.en}
                  </p>
                </div>
                <div className="float-up-container">
                  <p
                    className="float-up font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc] leading-relaxed"
                    style={{ animationDelay: `${(PARAGRAPHS.length * 2 + 1) * 0.1}s` }}
                  >
                    {QUOTE.zh}
                  </p>
                </div>
              </blockquote>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default AboutPage
