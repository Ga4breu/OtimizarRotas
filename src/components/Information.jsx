import React from 'react';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
const Navbar = () => {

return (
    <nav className="bg-black py-14 h-[80%] relative z-10 w-[100%] mt-4 flex gap-8  md2:flex-row flex-col place-items-center ">
        <div className="flex gap-2">
            <FaLinkedin className="text-white text-xl" />
            <h1 className="text-white text-xl">
                <a href="https://www.linkedin.com/in/gabrielsdeabreu/" className="text-white underline">linkedin.com/in/gabrielsdeabreu/</a>
            </h1>
        </div>
        <div className="flex gap-2">
            <FaGithub className="text-white text-xl" />
            <h1 className="text-white text-xl">
                <a href="https://github.com/Ga4breu" className="text-white underline">github.com/Ga4breu</a>
            </h1>
        </div>
    </nav>
);
}

export default Navbar;
