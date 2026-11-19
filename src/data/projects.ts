export interface Project {
  title: string;
  details: {
    challenge: string;
    solution: string;
    results: string;
  };
  location: string;
  about: {
    link: string;
    name: string;
    logo: string;
    image: string;
  };
}

export interface ProjectsList {
  category: string;
  description: string;
  projects: Project[];
}

export const projectCategories: ProjectsList[] = [
  {
    category: "Custom Software & AI Solutions",
    description:
      "Bespoke software engineering and AI-driven solutions built to address unique operational and business challenges. Our expertise covers full-stack development, custom ERP and CRM systems, next-generation UI/UX, and pioneering AI applications—delivering measurable improvements in efficiency, data integration, and decision-making for organizations across industries.",
    projects: [
      {
        title: "Custom ERP/CRM Tool",
        location: "Addis Ababa, Ethiopia",
        details: {
          challenge:
            "Inefficient internal processes and a lack of centralized data management were hindering operational scalability and creating data silos.",
          solution:
            "Developed a custom, all-in-one CRM/ERP tool tailored for internal use. The platform facilitates onboarding and employee metrics tracking, financial management and invoicing, lead and client relationship management, project management and resource allocation.",
          results:
            "Significantly enhanced operational efficiency, improved data visibility across all departments, and streamlined core business processes from HR to finance and project delivery."
        },
        about: {
          link: "https://www.251communications.com/",
          name: "251 Marketing & Communications",
          logo: "/our-work/251-logo.png",
          image: "/our-work/251-dashboard.png"
        }
      },
      {
        title: "Pharmaceutical Operations Dashboard",
        location: "Addis Ababa, Ethiopia",
        details: {
          challenge:
            "The client had a powerful pharmacy tracking system but lacked the UI/UX expertise to create a user-friendly dashboard for it.",
          solution:
            "Provided end-to-end UI/UX design and frontend implementation for a comprehensive pharmaceutical operations dashboard, turning complex data into a clean and intuitive interface.",
          results:
            "Delivered an intuitive dashboard that streamlined pharmacy operations. The enhanced UI led to increased user engagement and greater data accessibility for faster decision-making."
        },
        about: {
          link: "https://medrafa.et/",
          name: "Medrafa",
          logo: "/our-work/madrafa-logo.png",
          image: "/our-work/shots/madrafa.png"
        }
      },
      {
        title: "Custom Geotagging Software",
        location: "Virginia, USA",
        details: {
          challenge:
            "The client needed to perform highly specialized geospatial data processing that was impossible with their existing off-the-shelf tools.",
          solution:
            "Designed and developed a high-performance, customized geotagging software solution using the .NET framework, tailored to the client's unique data requirements.",
          results:
            'Empowered the client with a powerful, custom-built tool that unlocked new data analysis capabilities. The client stated: "Great experience with Zare; we have one of the most talented engineers to work with, couldn\'t be happier!"'
        },
        about: {
          link: "https://www.keysquarelabs.com/",
          name: "KeySquare Labs",
          logo: "/our-work/logos/keysquare.png",
          image: "/our-work/shots/keysquare.png"
        }
      }
    ]
  },
  {
    category: "Talent & BPO Operations",
    description:
      "Global talent sourcing and business process outsourcing for technology and customer service needs. We help clients overcome local talent shortages and reduce operational costs by recruiting, vetting, and integrating high-performing remote technical teams or customer support agents, yielding seamless expansion and notable cost-efficiency.",
    projects: [
      {
        title: "Built a 3-Engineer Remote Team",
        location: "Pennsylvania, USA",
        details: {
          challenge:
            "The client needed to expand its software team but was hindered by the high overhead costs and intense competition for talent in the USA.",
          solution:
            "Sourced, vetted, and recruited three full-time remote software developers from Ethiopia, creating a cost-effective and highly skilled global talent pipeline.",
          results:
            "Successfully integrated three high-performing developers into the client's team, cutting talent overhead costs by over 50% while exceeding all performance expectations."
        },
        about: {
          link: "https://pickrellglobaltechnologies.com/",
          name: "Pickrell Global Technologies",
          logo: "/our-work/logos/pickrell.png",
          image: "/our-work/shots/pickrell.png"
        }
      },
      {
        title: "Global UI/UX Designer Hire",
        location: "Nicosia, Cyprus",
        details: {
          challenge:
            "The Cyprus-based client faced a limited local talent pool for specialized UI/UX design skills, creating a bottleneck in their product development.",
          solution:
            "Conducted a targeted global search to identify and facilitate the direct hire of a top-tier remote UI/UX Designer from Ethiopia.",
          results:
            "The client successfully closed a critical skills gap by hiring a full-time remote designer who consistently exceeds performance expectations and brings a world-class design perspective."
        },
        about: {
          link: "https://www.exeliatech.com/",
          name: "Exelia Technologies",
          logo: "/our-work/logos/exelia-transparent.png",
          image: "/our-work/shots/exelia.png"
        }
      },
      {
        title: "Customer Service BPO",
        location: "Pittsburgh, Pennsylvania, USA",
        details: {
          challenge:
            "The client needed a scalable customer support operation for its US clientele without the high cost and administrative burden of an in-house team.",
          solution:
            "Deployed a full-service Business Process Outsourcing (BPO) solution, managing a dedicated team of customer service representatives from Ethiopia.",
          results:
            "Established a highly efficient and professional customer service operation that delivers exceptional service at a fraction of the cost, allowing the client to focus on core business growth."
        },
        about: {
          link: "https://crdle.com/",
          name: "CRDLE",
          logo: "/our-work/logos/crdle.png",
          image: "/our-work/shots/crdle.png"
        }
      },
      {
        title: "Rapid Talent Acquisition",
        location: "London, UK",
        details: {
          challenge:
            "The UK-based client faced the urgent need to staff over 80 positions for a new branch in Addis Ababa within an aggressive one-month deadline.",
          solution:
            "Deployed a rapid, high-volume talent acquisition strategy, leveraging deep local networks and an accelerated vetting process.",
          results:
            "Successfully delivered a vetted pipeline of over 80 qualified candidates within one month, enabling a smooth, on-schedule operational launch for the new African branch."
        },
        about: {
          link: "https://www.kagool.com/",
          name: "Kagool",
          logo: "/our-work/logos/kagol.svg",
          image: "/our-work/shots/kagol.png"
        }
      },
      {
        title: "Remote Back Office Support Specialist Placement",
        location: "Washington, D.C",
        details: {
          challenge:
            "The client needed a skilled back office support specialist to handle administrative operations but faced high local hiring costs and a competitive talent market in Washington, D.C.",
          solution:
            "Conducted a targeted global talent search and facilitated the direct hire of a qualified remote back office support specialist from Ethiopia, providing comprehensive vetting and onboarding support.",
          results:
            "Successfully placed a high-performing back office specialist who seamlessly integrated into the client's operations while maintaining exceptional service quality and reliability."
        },
        about: {
          link: "https://1013enterprise.com/",
          name: "10.13 Enterprise",
          logo: "/our-work/logos/10-13.png",
          image: "/our-work/shots/10-13.png"
        }
      }
    ]
  },
  {
    category: "Data-Driven Consulting & Intelligence Solutions",
    description:
      "We combine precise data mining and analysis with strategic consulting expertise to help organizations make better decisions. Our services span data acquisition and cleaning, business intelligence development, lead generation, and strategic advisory, enabling you to accelerate outreach and build lasting competitive advantages.",
    projects: [
      {
        title: "Media Database",
        location: "Sandton, South Africa",
        details: {
          challenge:
            "The client needed a comprehensive media contact list to support a pan-African communications campaign but lacked the resources to collect the data manually.",
          solution:
            "Executed a targeted data mining operation to collect contact details and social media information for 200 journalists across the African continent.",
          results:
            "Delivered a clean, verified, and actionable database of 200 key media contacts, empowering the client to launch a highly effective and targeted outreach campaign."
        },
        about: {
          link: "https://africacommunicationsgroup.com/",
          name: "Africa Communications Media Group",
          logo: "/our-work/logos/acmg.png",
          image: "/our-work/shots/acmg.png"
        }
      },
      {
        title: "Technology Consulting Services",
        location: "Washington, District of Columbia",
        details: {
          challenge:
            "A half-billion-dollar private equity fund needed comprehensive technology infrastructure and systems to support their operations, including investor reporting capabilities and ESG data management.",
          results:
            "Services include: Needs analysis and SAAS tool selection for a robust CRM, Automated ESG data collection and reporting systems, AI and ML enhancements for investor reporting, Custom development for an international e-commerce platform and Integrated AI tools for streamlining board meeting summary documents",
          solution: "Delivered comprehensive technology consulting services."
        },
        about: {
          link: "https://www.afigfunds.com/",
          name: "AFIG FUNDS",
          logo: "/our-work/logos/afig-funds.png",
          image: "/our-work/shots/afig-funds.png"
        }
      }
    ]
  },
  {
    category: "Website development",
    description:
      "We specialize in crafting exceptional websites and intuitive UI/UX designs, delivering engaging digital experiences that captivate users and drive results.",
    projects: [
      {
        title: "GURSHA ETHIOPIAN KITCHEN",
        location: "Nairobi, Kenya",
        details: {
          challenge: "",
          solution: "",
          results: ""
        },
        about: {
          link: "https://gursharestaurant.com",
          name: "",
          logo: "/our-work/logos/gursha.png",
          image: "/our-work/shots/gursha.png"
        }
      },
      {
        title: "KAZANA Group",
        location: "Addis Ababa, Ethiopia",
        details: {
          challenge: "",
          solution: "",
          results: ""
        },
        about: {
          link: "https://www.kazanagroup.com/",
          name: "",
          logo: "/our-work/logos/kazana.png",
          image: "/our-work/shots/kazana.png"
        }
      },
      {
        title: "Just Kids Autism Center",
        location: "Minnesota, USA",
        details: {
          challenge: "",
          solution: "",
          results: ""
        },
        about: {
          link: "https://www.justkidsmn.com/",
          name: "",
          logo: "/our-work/logos/just-kids.png",
          image: "/our-work/shots/just-kids.png"
        }
      },
      {
        title: "Better Life",
        location: "Oregon, USA",
        details: {
          challenge: "",
          solution: "",
          results: ""
        },
        about: {
          link: "https://www.betterlifeorg.com/",
          name: "",
          logo: "/our-work/logos/betterlife.svg",
          image: "/our-work/shots/better-life.png"
        }
      },
      {
        title: "Sunbeam ABA Center",
        location: "Oregon, USA",
        details: {
          challenge: "",
          solution: "",
          results: ""
        },
        about: {
          link: "https://www.sunbeamaba.org",
          name: "",
          logo: "/our-work/logos/sunbeam-logo.png",
          image: "/our-work/shots/sunbeam.png"
        }
      },
      {
        title: "HK Financial Advisory LLC",
        location: "Virginia, USA",
        details: {
          challenge: "",
          solution: "",
          results: ""
        },
        about: {
          link: "https://www.hkfinancialadvisory.com/",
          name: "",
          logo: "/our-work/logos/hk.svg",
          image: "/our-work/shots/hk.png"
        }
      },
      {
        title: "Signature Residence",
        location: "Addis Ababa, Ethiopia",
        details: {
          challenge: "",
          solution: "",
          results: ""
        },
        about: {
          link: "https://thesignatureresidence.com/",
          name: "",
          logo: "/our-work/logos/signature-logo.svg",
          image: "/our-work/shots/signature.png"
        }
      },
      {
        title: "Sabbell",
        location: "Addis Ababa, Ethiopia",
        details: {
          challenge: "",
          solution: "",
          results: ""
        },
        about: {
          link: "https://sabbell.com/",
          name: "",
          logo: "/our-work/logos/sabbell.png",
          image: "/our-work/shots/sabbell.png"
        }
      }
    ]
  }
];
