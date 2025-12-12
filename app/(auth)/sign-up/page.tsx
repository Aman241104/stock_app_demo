'use client';
import {SubmitHandler, useForm} from "react-hook-form";
import {Button} from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import {INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS} from "@/lib/constants";
import {CountrySelectField} from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";

const SignIn = () => {

    const {
        register,
        handleSubmit,
        control,
        formState:{ errors, isSubmitting },
    } = useForm<SignUpFormData>({
        defaultValues:{
            fullName:'',
            email:'',
            password:'',
            country:'IN',
            investmentGoals:'Growth',
            riskTolerance:'Medium',
            preferredIndustry:'Technology',
        },
        mode:'onBlur',
    },);

    const onSubmit = async(data:SignUpFormData) => {
        try{
            console.log(data);
        }catch(e){
            console.log(e);
        }
    }

    return (
        <>
            <h1 className="form-title">Sign Up & Personalize</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="fullname"
                    label="Full Name"
                    placeholder="John Doe"
                    register={register}
                    error={errors.fullName}
                    validation={{required:'Full name is required',minLength:2}}
                />
                <InputField
                    name="emial"
                    label="Email"
                    placeholder="contact@gmail.com"
                    type="email"
                    register={register}
                    error={errors.email}
                    validation={{required:'Email is required',pattern:/^\w+@\w+\.\w+$/}}
                />
                <InputField
                    name="password"
                    label="Password"
                    placeholder="Enter a strong password"
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{required:'Password is required',minLength:8}}
                />

                <CountrySelectField
                name="country"
                label="Country"
                control={control}
                error={errors.country}
                required
                />

                <SelectField
                    name="investmentGoals"
                    label="Investment Goals"
                    options={INVESTMENT_GOALS}
                    control={control}
                    error={errors.investmentGoals}
                    required
                />

                <SelectField
                    name="riskTolerance"
                    label="Risk Tolerance"
                    options={RISK_TOLERANCE_OPTIONS}
                    control={control}
                    error={errors.riskTolerance}
                    required
                />

                <SelectField
                    name="preferredIndustry"
                    label="Preferred Industry"
                    placeholder="Select your preferred Industry"
                    options={PREFERRED_INDUSTRIES}
                    control={control}
                    error={errors.preferredIndustry}
                    required
                />


                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'Creating account':'Start Your Invensting Journey'}
                </Button>

                <FooterLink text="Already have an account?" linkText="Sign in" href="/sign-in" />
            </form>
        </>
    )
}
export default SignIn
