import { Route, BrowserRouter, Routes } from "react-router-dom";
import Login from "../screens/Login";
import Register from "../screens/Register";
import Home from "../screens/Home";
import Project from "../screens/Project";
import UserAuth from "../auth/UserAuth";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public home route: shows Dashboard if logged in, Landing Page if guest */}
        <Route path="/" element={<Home />} />

        {/* Dedicated landing page route */}
        <Route path="/landing" element={<Home forceLanding={true} />} />

        {/* Explicit protected dashboard route */}
        <Route path="/dashboard" element={<UserAuth><Home /></UserAuth>} />

        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected project workspace */}
        <Route path="/project" element={<UserAuth><Project /></UserAuth>} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;