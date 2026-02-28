import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home";
import Players from "./pages/Players";

// 기존의 useState나 로고 import는 이제 필요 없으므로 지워줍니다.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* AppLayout이 전체 틀(Navbar 등)을 잡고 있습니다 */}
        <Route element={<AppLayout />}>
          {/* 주소창에 / 가 들어오면 Home 컴포넌트를 보여줍니다 */}
          <Route path="/" element={<Home />} />
          
          {/* 주소창에 /players 가 들어오면 Players 컴포넌트를 보여줍니다 */}
          <Route path="/players" element={<Players />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;