import { Link, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { UserContext } from "../context/user.context";
import axios from "../config/axios";

const features = [
  {
    icon: "ri-chat-3-line",
    title: "Real-time Collaboration",
    desc: "Communicate with team members in dedicated project rooms with instant socket synchronization.",
  },
  {
    icon: "ri-sparkling-fill",
    title: "CodeForge AI Assistant",
    desc: "Embedded Google Gemini model to stream, explain, fix, refactor, and write clean production code.",
  },
  {
    icon: "ri-code-box-line",
    title: "WebContainer Runtime",
    desc: "In-browser Node.js runtime and Pyodide WebAssembly Python execution with interactive xterm.js terminal.",
  },
  {
    icon: "ri-shield-check-line",
    title: "Role-Based Access Control",
    desc: "Fine-grained permissions for Owners, Editors, and Viewers with IDOR and mutation protection.",
  },
];

const HomePage = ({ forceLanding = false }) => {
  const { user, setUser } = useContext(UserContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [project, setProject] = useState([]);
  const navigate = useNavigate();

  function handleSignOut() {
    axios.get('/users/logout').catch(() => {});
    setUser(null);
    localStorage.removeItem('token');
    navigate('/login');
  }

  function createProject(e) {
    e.preventDefault();
    if (!projectName || !projectName.trim()) return;

    axios.post('/projects/create', { name: projectName.trim() })
      .then(() => {
        setIsModalOpen(false);
        setProjectName('');
        axios.get('/projects/all').then((res) => {
          setProject(res.data.projects || []);
        }).catch(err => console.log(err));
      })
      .catch((error) => {
        console.error("Create project error:", error);
        alert(error.response?.data?.message || "Failed to create project");
      });
  }

  const handleDeleteProject = (e, projectId, pName) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete project "${pName}"? This action cannot be undone.`)) return;

    axios.delete(`/projects/${projectId}`)
      .then(() => {
        setProject(prev => prev.filter(p => p._id !== projectId));
      })
      .catch(err => {
        console.error("Delete project error:", err);
        alert(err.response?.data?.message || "Failed to delete project");
      });
  };

  useEffect(() => {
    if (user && !forceLanding) {
      axios.get('/projects/all').then((res) => {
        setProject(res.data.projects || []);
      }).catch(err => {
        console.log(err);
      });
    }
  }, [user, forceLanding]);

  // ── LOGGED-IN DASHBOARD (When user is logged in & not requesting landing page) ──
  if (user && !forceLanding) {
    const totalCollaborators = project.reduce((sum, p) => sum + (p.users?.length || p.members?.length || 0), 0);
    const initials = user.email ? user.email.slice(0, 2).toUpperCase() : "U";

    return (
      <div className="min-h-screen bg-[#080810] text-[#f4f4f5] font-sans overflow-x-hidden relative">
        {/* Ambient Glows */}
        <div className='absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-[120px] pointer-events-none' />
        <div className='absolute top-[20%] right-[-100px] w-[500px] h-[500px] rounded-full bg-fuchsia-700/10 blur-[120px] pointer-events-none' />

        {/* Navigation Bar */}
        <nav className="fixed top-0 left-0 right-0 z-50 h-[56px] px-6 md:px-12 border-b border-white/10 glass-panel flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-violet-500/25">
              C
            </div>
            <span className="text-base font-bold tracking-tight text-white">CodeForge</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/landing"
              className="text-xs text-zinc-300 hover:text-white transition-colors font-medium hidden sm:inline"
            >
              Landing Page
            </Link>

            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shadow-xs">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white">
                {initials}
              </div>
              <span className="text-xs text-zinc-200 hidden sm:inline font-medium">{user.email}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1"
            >
              Sign out
            </button>
          </div>
        </nav>

        {/* Dashboard Content */}
        <div className="pt-24 pb-16 px-6 md:px-12 max-w-6xl mx-auto space-y-8 relative z-10">
          {/* Header */}
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-violet-400 font-bold">Workspace</span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">
              Projects Dashboard
            </h1>
            <p className="text-sm text-zinc-400 mt-1">Manage your collaborative workspaces, AI sessions, and repositories.</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Active Projects", value: project.length, icon: "ri-folder-3-line" },
              { label: "Collaborators", value: totalCollaborators, icon: "ri-team-line" },
              { label: "AI Engine", value: "Gemini AI", icon: "ri-sparkling-fill" },
            ].map((stat, i) => (
              <div key={i} className="glass-panel rounded-2xl p-5 flex items-center gap-4 shadow-lg">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0 text-xl shadow-inner">
                  <i className={stat.icon}></i>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-medium">{stat.label}</p>
                  <p className="text-xl font-bold text-white mt-0.5">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Projects Header & Action */}
          <div className="flex items-center justify-between pt-2">
            <h2 className="text-lg font-bold text-white">Your Workspaces</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 text-xs font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-violet-500/25"
            >
              <i className="ri-add-line text-sm"></i>
              <span>New Project</span>
            </button>
          </div>

          {/* Projects Grid */}
          {project.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 glass-panel border-dashed rounded-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 text-2xl">
                <i className="ri-folder-add-line"></i>
              </div>
              <p className="text-zinc-400 text-sm">No projects found. Create your first workspace to start coding.</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-violet-500/25"
              >
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.map((p) => {
                const isProjectOwner = p.owner?._id === user._id || p.owner === user._id || (p.users && p.users[0] === user._id);
                const collaboratorCount = p.members?.length || p.users?.length || 0;

                return (
                  <div
                    key={p._id}
                    onClick={() => navigate('/project', { state: { project: p } })}
                    className="group glass-panel hover:border-violet-500/50 rounded-2xl p-5 cursor-pointer transition-all relative shadow-lg hover:shadow-violet-500/10 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-300 group-hover:text-white group-hover:bg-violet-600 transition-all shadow-inner">
                        <i className="ri-terminal-box-line text-lg"></i>
                      </div>

                      <div className="flex items-center gap-1">
                        {isProjectOwner && (
                          <button
                            onClick={(e) => handleDeleteProject(e, p._id, p.name)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                            title="Delete Project (Owner Only)"
                          >
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        )}
                        <i className="ri-arrow-right-line text-sm text-zinc-500 group-hover:text-violet-400 transition-colors"></i>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-white mb-1 truncate">{p.name}</h3>
                    <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                      <span>{collaboratorCount} member{collaboratorCount !== 1 ? 's' : ''}</span>
                      {isProjectOwner && (
                        <span className="text-amber-400 font-semibold">Owner</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Project Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50 p-4">
            <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Create New Project</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <i className="ri-close-line text-lg"></i>
                </button>
              </div>

              <form onSubmit={createProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5 font-semibold">Project Name</label>
                  <input
                    onChange={(e) => setProjectName(e.target.value)}
                    value={projectName || ''}
                    type="text"
                    placeholder="e.g. backend-api, web-client"
                    className="w-full bg-[#14141a] border border-white/10 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 transition-colors font-mono"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs text-zinc-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-violet-500/25"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── GUEST & PUBLIC LANDING PAGE ──
  return (
    <div className="min-h-screen bg-[#080810] text-[#f4f4f5] font-sans overflow-x-hidden relative">
      {/* Ambient Glows */}
      <div className='absolute top-[-120px] left-[-120px] w-[550px] h-[550px] rounded-full bg-violet-700/20 blur-[130px] pointer-events-none' />
      <div className='absolute top-[20%] right-[-120px] w-[550px] h-[550px] rounded-full bg-fuchsia-700/15 blur-[130px] pointer-events-none' />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[56px] px-6 md:px-12 border-b border-white/10 glass-panel flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-violet-500/25">
            C
          </div>
          <span className="text-base font-bold tracking-tight text-white">CodeForge</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/"
              className="text-xs font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-violet-500/25 flex items-center gap-1.5"
            >
              <i className="ri-dashboard-line text-sm"></i>
              <span>Open Workspace</span>
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-xs text-zinc-300 hover:text-white transition-colors px-3 py-1.5 font-medium">
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-xs font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-violet-500/25"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 md:px-12 flex flex-col items-center text-center max-w-4xl mx-auto space-y-6 relative z-10">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-zinc-300 shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Build together. Code smarter.</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Collaborative AI-Powered <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Cloud IDE</span>
        </h1>

        <p className="text-base md:text-lg text-zinc-300 max-w-2xl leading-relaxed">
          CodeForge is a collaborative AI-powered cloud development workspace where developers can write, run, and improve code together in real time.
        </p>

        <div className="flex items-center gap-4 pt-4">
          {user ? (
            <Link
              to="/"
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-500/30 hover:scale-[1.02] flex items-center gap-2"
            >
              <span>Go to Your Projects</span>
              <i className="ri-arrow-right-line"></i>
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-500/30 hover:scale-[1.02]"
              >
                Start Free Workspace →
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-all"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="glass-panel rounded-2xl p-6 space-y-3 shadow-lg hover:border-violet-500/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-lg shadow-inner">
                <i className={f.icon}></i>
              </div>
              <h3 className="text-sm font-bold text-white">{f.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 md:px-12 py-8 flex items-center justify-between text-xs text-zinc-400 relative z-10">
        <span>© {new Date().getFullYear()} CodeForge IDE</span>
        <div className="flex gap-4">
          {user ? (
            <Link to="/" className="hover:text-white transition-colors">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
              <Link to="/register" className="hover:text-white transition-colors">Register</Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};

export default HomePage;